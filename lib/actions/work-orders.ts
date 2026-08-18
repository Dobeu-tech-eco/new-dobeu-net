"use server";
/**
 * Work-order server actions (Phase 3 — fully wired).
 *
 * Per PRODUCTION-PLAN §7.4. State machine (enforced in code via TRANSITIONS):
 *   open → quoted → accepted → in_progress → delivered → closed
 *     └──────┴──────────┴───────────┴────────────┴──→ cancelled
 * `closed` and `cancelled` are terminal. `cancelled` is reachable from any
 * non-terminal state. Both `quoteWorkOrder` and `updateWorkOrderStatus`
 * read current status first and reject illegal transitions.
 *
 * Notifications go through `lib/resend.ts` + `lib/resend-templates.ts`. Every
 * email send is wrapped so a Resend / DKIM failure cannot break the underlying
 * action (work order still progresses).
 *
 * Invoice model (LOCKED): accepting a quote ONLY flips the work order to
 * `accepted` (+ `accepted_at`). The Stripe invoice is created later by the
 * ADMIN via the "Create Stripe Invoice" button (→ `createInvoiceForWorkOrder`
 * in lib/actions/invoices.ts). There is intentionally no auto-invoice on
 * accept — `work_orders.project_id` was never set client-side, so that branch
 * was dead anyway.
 *
 * Attachment uploads are a two-step signed-URL flow:
 *   1. `submitWorkOrder` validates size + MIME, inserts the work order, and
 *      mints a signed upload URL per attachment (no row inserted yet).
 *   2. The client PUTs the bytes, then calls `finalizeWorkOrderAttachment`
 *      which inserts the `work_order_attachments` row pointing at the real
 *      object. Row-after-bytes means a failed PUT never leaves a dangling
 *      attachment row whose signed-download link 404s.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, requireAdmin, AuthError } from "@/lib/actions/auth";
import type { WorkOrderStatus } from "@/lib/database.types";
import { sendEmail } from "@/lib/resend";
import {
  workOrderReceivedToAdmin,
  workOrderQuoteSentToClient,
  workOrderAcceptedToAdmin,
  workOrderStatusChangedToClient
} from "@/lib/resend-templates";
import { cioTrack, isCustomerIoConfigured } from "@/lib/customerio";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Allowed work-order status transitions. `closed`/`cancelled` are terminal
 * (empty arrays). `cancelled` is reachable from every non-terminal state.
 */
const TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  open: ["quoted", "cancelled"],
  quoted: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["delivered", "cancelled"],
  delivered: ["closed", "cancelled"],
  closed: [],
  cancelled: []
};

function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

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

const ADMIN_NOTIFY_TO = (): string =>
  process.env.RESEND_REPLY_TO ?? "jeremyw@dobeu.net";

/** One signed upload target the client PUTs bytes to, then finalizes. */
export interface UploadTarget {
  storage_path: string;
  token: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export async function submitWorkOrder(
  raw: unknown
): Promise<ActionResult<{ id: string; uploadPaths: string[]; uploadTargets: UploadTarget[] }>> {
  const parsed = submitInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;

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
  const uploadTargets: UploadTarget[] = [];

  // Mint a signed upload URL per attachment using the SERVICE-ROLE client.
  // Ownership is already established (requireUser + the WO insert above) and
  // the signed token itself authorizes the client's subsequent PUT — minting
  // via admin sidesteps any sign-time RLS evaluation of the storage INSERT
  // policy, so a freshly-created WO can never fail to mint for a policy reason.
  // The path is `<work_order_id>/...` which also satisfies that policy at PUT
  // time. NO attachment row is inserted here — the client PUTs the bytes, then
  // calls `finalizeWorkOrderAttachment` (cookie-bound, RLS-enforced) to insert
  // the row. Row-after-bytes keeps signed-download links from 404ing.
  const storageAdmin = createAdminClient();
  for (const att of input.attachments ?? []) {
    const storagePath = `${workOrderId}/${crypto.randomUUID()}-${att.filename}`;
    const { data: signed, error: signErr } = await storageAdmin.storage
      .from("work-order-attachments")
      .createSignedUploadUrl(storagePath);
    if (signErr || !signed) {
      console.warn(
        "[submitWorkOrder] signed upload URL failed for",
        att.filename,
        signErr?.message
      );
      continue;
    }
    uploadPaths.push(storagePath);
    uploadTargets.push({
      storage_path: storagePath,
      token: signed.token,
      filename: att.filename,
      mime_type: att.mime_type,
      size_bytes: att.size_bytes
    });
  }

  const profileEmail = user.email ?? "(no email)";
  const profileName =
    (user.user_metadata as { full_name?: string } | null)?.full_name ?? null;

  // Resend admin notification (non-fatal).
  try {
    const tpl = workOrderReceivedToAdmin({
      workOrder: {
        id: workOrderId,
        title: input.title,
        service_type: input.service_type,
        description: input.description ?? null
      },
      client: { email: profileEmail, name: profileName }
    });
    await sendEmail({
      to: ADMIN_NOTIFY_TO(),
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html
    });
  } catch (e) {
    console.warn("[submitWorkOrder] admin notify failed (non-fatal):", e);
  }

  // Emit a best-effort `work_order_created` event (non-fatal — mirrors
  // processLead's discipline; a failure here must never drop the work order).
  //
  // NOTE: there is no server-side Intercom event helper in this codebase
  // (lib/intercom.ts is the client-side Messenger SDK only). Customer.io is
  // the established server-side event channel (lib/customerio.ts, used by the
  // lead pipeline), so the event lands there. If/when a server Intercom event
  // API is added, point this at it instead.
  try {
    if (user.email && isCustomerIoConfigured()) {
      const res = await cioTrack({
        email: user.email,
        name: "work_order_created",
        data: {
          work_order_id: workOrderId,
          title: input.title,
          service_type: input.service_type
        }
      });
      if (!res.ok) {
        console.warn("[submitWorkOrder] work_order_created event failed (non-fatal):", res.error);
      }
    }
  } catch (e) {
    console.warn("[submitWorkOrder] work_order_created event threw (non-fatal):", e);
  }

  revalidatePath("/portal");
  revalidatePath("/portal/tickets");
  revalidatePath("/admin");
  revalidatePath("/admin/tickets");
  return { ok: true, data: { id: workOrderId, uploadPaths, uploadTargets } };
}

const finalizeAttachmentInput = z.object({
  work_order_id: uuid,
  storage_path: z.string().min(1).max(512),
  filename: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(127),
  size_bytes: z.number().int().nonnegative()
});

/**
 * Insert the `work_order_attachments` row AFTER the client has PUT the bytes
 * to the signed upload URL minted by `submitWorkOrder`. RLS (`wo_att_insert_own`)
 * ensures the caller owns the work order, and the storage_path is re-validated
 * to live under `<work_order_id>/` so a row can't point outside the WO's
 * namespace. Re-validates size + MIME (defense in depth).
 */
export async function finalizeWorkOrderAttachment(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = finalizeAttachmentInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;

  if (input.size_bytes > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `attachment "${input.filename}" exceeds 25 MB cap` };
  }
  if (!ALLOWED_MIME.has(input.mime_type)) {
    return { ok: false, error: `attachment "${input.filename}" mime ${input.mime_type} not allowed` };
  }
  if (!input.storage_path.startsWith(`${input.work_order_id}/`)) {
    return { ok: false, error: "storage_path outside work-order namespace" };
  }

  let supabase;
  try {
    ({ supabase } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data, error } = await supabase
    .from("work_order_attachments")
    .insert({
      work_order_id: input.work_order_id,
      storage_path: input.storage_path,
      filename: input.filename,
      mime_type: input.mime_type,
      size_bytes: input.size_bytes
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "attachment insert failed" };

  revalidatePath(`/portal/tickets/${input.work_order_id}`);
  revalidatePath(`/admin/tickets/${input.work_order_id}`);
  return { ok: true, data: { id: data.id } };
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

  // Read current status first — a quote is only legal from `open` (open→quoted).
  // Without this guard a closed/cancelled work order could be resurrected.
  const { data: current, error: readErr } = await admin
    .from("work_orders")
    .select("status")
    .eq("id", id)
    .single();
  if (readErr || !current) return { ok: false, error: readErr?.message ?? "work order not found" };
  if (!canTransition(current.status as WorkOrderStatus, "quoted")) {
    return { ok: false, error: `cannot quote from status "${current.status}"` };
  }

  const { data, error } = await admin
    .from("work_orders")
    .update({
      status: "quoted",
      quoted_amount_cents: amount_cents,
      quoted_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("id,title,service_type,created_by")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "update failed" };

  // Email the work-order owner that a quote is ready.
  try {
    const recipient = await resolveOwnerEmail(admin, data.created_by);
    if (recipient) {
      const tpl = workOrderQuoteSentToClient({
        workOrder: { id: data.id, title: data.title, service_type: data.service_type },
        amountCents: amount_cents
      });
      await sendEmail({
        to: recipient,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html
      });
    }
  } catch (e) {
    console.warn("[quoteWorkOrder] client email failed (non-fatal):", e);
  }

  revalidatePath("/admin/tickets");
  revalidatePath("/portal/tickets");
  return { ok: true, data: { id: data.id } };
}

const acceptInput = z.object({ id: uuid });

export async function acceptWorkOrderQuote(
  raw: unknown
): Promise<ActionResult<{ id: string; invoice_id: string | null }>> {
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

  const { data: existing, error: readErr } = await supabase
    .from("work_orders")
    .select("id,created_by,status,quoted_amount_cents,title")
    .eq("id", id)
    .single();

  if (readErr || !existing) return { ok: false, error: "work order not found" };
  if (existing.created_by !== user.id) return { ok: false, error: "forbidden" };
  if (existing.status !== "quoted") {
    return { ok: false, error: `cannot accept from status "${existing.status}"` };
  }
  if (!existing.quoted_amount_cents || existing.quoted_amount_cents <= 0) {
    return { ok: false, error: "work order has no quote amount" };
  }

  // Write via the service-role client, not the cookie-bound one. Ownership +
  // status + amount are already fully validated above; the write itself no
  // longer depends on a client-writable RLS policy (there isn't one — see
  // 20260717064702_rls_hardening_wo_and_anon_insert.sql), matching the same
  // defense-in-depth pattern quoteWorkOrder/updateWorkOrderStatus already use.
  const admin = createAdminClient();
  const { error: flipErr } = await admin
    .from("work_orders")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", id);

  if (flipErr) return { ok: false, error: flipErr.message };

  // Email admin that the quote was accepted (non-fatal). This is the cue for
  // the admin to issue the Stripe invoice from /admin/tickets/[id].
  try {
    const tpl = workOrderAcceptedToAdmin({
      workOrder: { id: existing.id, title: existing.title, service_type: "" }
    });
    await sendEmail({
      to: ADMIN_NOTIFY_TO(),
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html
    });
  } catch (e) {
    console.warn("[acceptWorkOrderQuote] admin notify failed (non-fatal):", e);
  }

  // Invoice creation is intentionally NOT triggered here — the admin issues
  // the Stripe invoice explicitly via `createInvoiceForWorkOrder`. `invoice_id`
  // stays null until then. (Kept in the return shape for the AcceptQuoteForm
  // consumer, which is outside this lane.)
  revalidatePath("/portal/tickets");
  revalidatePath("/admin/tickets");
  return { ok: true, data: { id, invoice_id: null } };
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

  // Read current status and enforce the transition (the Zod enum only checks
  // the target is a valid status, not that open→...→target is legal).
  const { data: current, error: readErr } = await admin
    .from("work_orders")
    .select("status")
    .eq("id", id)
    .single();
  if (readErr || !current) return { ok: false, error: readErr?.message ?? "work order not found" };
  if (!canTransition(current.status as WorkOrderStatus, status)) {
    return { ok: false, error: `illegal transition "${current.status}" → "${status}"` };
  }

  // Stamp the per-status timestamp so the client timeline can render it.
  const now = new Date().toISOString();
  const stamp: Record<string, string> = { status };
  if (status === "in_progress") stamp.in_progress_at = now;
  else if (status === "delivered") stamp.delivered_at = now;
  else if (status === "closed") stamp.closed_at = now;
  else if (status === "cancelled") stamp.cancelled_at = now;

  const { data, error } = await admin
    .from("work_orders")
    // Cast: the `*_at` columns land in lib/database.types.ts via the central
    // `pnpm db:types` regen (migration 20260618000000); stale types until then.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(stamp as any)
    .eq("id", id)
    .select("id,title,service_type,created_by")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "update failed" };

  // Email the owner about the status change (in_progress/delivered/closed/cancelled).
  try {
    const recipient = await resolveOwnerEmail(admin, data.created_by);
    if (recipient) {
      const tpl = workOrderStatusChangedToClient({
        workOrder: { id: data.id, title: data.title, service_type: data.service_type },
        newStatus: status
      });
      await sendEmail({
        to: recipient,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html
      });
    }
  } catch (e) {
    console.warn("[updateWorkOrderStatus] client email failed (non-fatal):", e);
  }

  revalidatePath("/admin/tickets");
  revalidatePath("/portal/tickets");
  return { ok: true, data: { id, status } };
}

/**
 * Resolve a work-order owner's email via service-role admin client.
 * Returns null (don't throw) on lookup failure so emails stay non-fatal.
 */
async function resolveOwnerEmail(
  admin: { auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string | null } | null } | null }> } } },
  userId: string
): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch (e) {
    console.warn("[resolveOwnerEmail] lookup failed:", e);
    return null;
  }
}
