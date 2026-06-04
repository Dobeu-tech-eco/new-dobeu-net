"use server";
/**
 * Work-order server actions (Phase 2 scaffold).
 *
 * Per PRODUCTION-PLAN §7.4. UI surfaces (portal & admin ticket pages) ship
 * in Phase 3 — these actions are functional + tested now so Phase 3 only has
 * to wire <form action={...}> calls.
 *
 * Notification fan-out (Resend, Intercom) and the Stripe-invoice creation
 * trigger are deliberately stubbed with PHASE 3 TODO markers — `lib/resend.ts`
 * doesn't exist yet and the Stripe wiring is the next phase's work.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, requireAdmin, AuthError } from "@/lib/actions/auth";
import type { WorkOrderStatus } from "@/lib/database.types";

// 25 MB cap per the production plan §7.3.
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// MIME allowlist (production plan §7.3). Executables/binaries rejected.
const ALLOWED_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv"
]);

const uuid = z.string().uuid("invalid id");
const positiveInt = z
  .number()
  .int("must be an integer")
  .positive("must be > 0")
  .max(1_000_000_000, "absurdly large");

const submitInput = z.object({
  service_type: z.enum(["logo", "website_update", "data_export", "consulting", "other"]),
  title: z.string().trim().min(2, "title too short").max(160, "title too long"),
  description: z.string().trim().max(8000).optional().nullable(),
  // Attachments shaped as plain metadata; actual upload happens against the
  // signed URL the action returns (Phase 3 wires the client-side upload step).
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mime_type: z.string().min(1).max(127),
        size_bytes: z.number().int().nonnegative()
      })
    )
    .max(8, "too many attachments")
    .optional()
});

export type SubmitWorkOrderInput = z.infer<typeof submitInput>;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function submitWorkOrder(
  raw: unknown
): Promise<ActionResult<{ id: string; uploadPaths: string[] }>> {
  const parsed = submitInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;

  // Validate attachments first so we fail before doing any DB write.
  for (const att of input.attachments ?? []) {
    if (att.size_bytes > MAX_FILE_SIZE_BYTES) {
      return { ok: false, error: `attachment "${att.filename}" exceeds 25 MB cap` };
    }
    if (!ALLOWED_MIME.has(att.mime_type)) {
      return { ok: false, error: `attachment "${att.filename}" mime ${att.mime_type} not allowed` };
    }
  }

  let user, supabase;
  try {
    ({ user, supabase } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // Insert work order — RLS enforces created_by = auth.uid().
  const { data: inserted, error: insertErr } = await supabase
    .from("work_orders")
    .insert({
      created_by: user.id,
      service_type: input.service_type,
      title: input.title,
      description: input.description ?? null,
      status: "open"
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "insert failed" };
  }

  const workOrderId = inserted.id;
  const uploadPaths: string[] = [];

  for (const att of input.attachments ?? []) {
    const storagePath = `${workOrderId}/${crypto.randomUUID()}-${att.filename}`;
    const { error: attErr } = await supabase.from("work_order_attachments").insert({
      work_order_id: workOrderId,
      storage_path: storagePath,
      filename: att.filename,
      mime_type: att.mime_type,
      size_bytes: att.size_bytes
    });
    if (attErr) {
      console.warn("[submitWorkOrder] attachment row insert failed:", attErr.message);
      continue;
    }
    uploadPaths.push(storagePath);
    // PHASE 3: issue signed upload URL via supabase.storage.from("work-order-attachments")
    //          .createSignedUploadUrl(storagePath) and return it to the client.
  }

  // PHASE 3: wire resend admin notification + Intercom `work_order_created` event.

  revalidatePath("/portal");
  revalidatePath("/portal/tickets");
  revalidatePath("/admin");
  return { ok: true, data: { id: workOrderId, uploadPaths } };
}

const quoteInput = z.object({
  id: uuid,
  amount_cents: positiveInt
});

export async function quoteWorkOrder(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = quoteInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { id, amount_cents } = parsed.data;

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data, error } = await admin
    .from("work_orders")
    .update({
      status: "quoted",
      quoted_amount_cents: amount_cents,
      quoted_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "update failed" };

  // PHASE 3: wire resend "you've been quoted" email to the work-order owner.

  revalidatePath("/admin/tickets");
  revalidatePath("/portal/tickets");
  return { ok: true, data: { id: data.id } };
}

const acceptInput = z.object({ id: uuid });

export async function acceptWorkOrderQuote(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = acceptInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { id } = parsed.data;

  let user, supabase;
  try {
    ({ user, supabase } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // Defense-in-depth on top of RLS: explicitly check ownership + current status.
  // (RLS also constrains the update to `created_by = auth.uid() and status='quoted'`,
  // but the explicit pre-check yields a friendly error instead of `0 rows updated`.)
  const { data: existing, error: readErr } = await supabase
    .from("work_orders")
    .select("id,created_by,status")
    .eq("id", id)
    .single();

  if (readErr || !existing) return { ok: false, error: "work order not found" };
  if (existing.created_by !== user.id) return { ok: false, error: "forbidden" };
  if (existing.status !== "quoted") {
    return { ok: false, error: `cannot accept from status "${existing.status}"` };
  }

  const { error } = await supabase
    .from("work_orders")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // PHASE 3: trigger Stripe invoice creation -- admin queue gets the accepted
  // ticket so they can click "Create Stripe Invoice" which sets work_orders.invoice_id.

  revalidatePath("/portal/tickets");
  revalidatePath("/admin/tickets");
  return { ok: true, data: { id } };
}

const updateStatusInput = z.object({
  id: uuid,
  status: z.enum(["in_progress", "delivered", "closed", "cancelled"])
});

export async function updateWorkOrderStatus(
  raw: unknown
): Promise<ActionResult<{ id: string; status: WorkOrderStatus }>> {
  const parsed = updateStatusInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { id, status } = parsed.data;

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { error } = await admin
    .from("work_orders")
    .update({ status })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // PHASE 3: wire resend status-update email to the work-order owner.

  revalidatePath("/admin/tickets");
  revalidatePath("/portal/tickets");
  return { ok: true, data: { id, status } };
}
