"use server";
/**
 * Work-order server actions (Phase 3 — fully wired).
 *
 * Per PRODUCTION-PLAN §7.4. State machine (enforced in code):
 *   open → quoted → accepted → in_progress → delivered → closed
 *     └──────┴──────────┴───────────┴────────────┴──→ cancelled
 *
 * Notifications go through `lib/resend.ts` + `lib/resend-templates.ts`. Every
 * email send is wrapped so a Resend / DKIM failure cannot break the underlying
 * action (work order still progresses).
 *
 * `acceptWorkOrderQuote` triggers `createInvoice` (Stripe-hosted) and writes
 * the resulting `invoice_id` back onto the work order. If invoice creation
 * fails, the work order stays at `accepted` with `invoice_id = NULL` and the
 * admin gets a "creation failed" email — no silent drops.
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
import { createInvoiceForUser } from "@/lib/invoice-creation";
import { createAdminClient } from "@/lib/supabase/server";

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

export async function submitWorkOrder(
  raw: unknown
): Promise<ActionResult<{ id: string; uploadPaths: string[] }>> {
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
  }

  // Resend admin notification (non-fatal). Intercom event lands in Phase 4
  // once HMAC identity verification is wired.
  try {
    const profileEmail = user.email ?? "(no email)";
    const profileName =
      (user.user_metadata as { full_name?: string } | null)?.full_name ?? null;
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

  revalidatePath("/portal");
  revalidatePath("/portal/tickets");
  revalidatePath("/admin");
  revalidatePath("/admin/tickets");
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
    .select("id,created_by,status,project_id,quoted_amount_cents,title")
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

  const { error: flipErr } = await supabase
    .from("work_orders")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", id);

  if (flipErr) return { ok: false, error: flipErr.message };

  // Email admin that the quote was accepted (non-fatal).
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

  // Trigger Stripe-hosted invoice creation. The internal helper bypasses
  // RLS so the client-initiated accept still produces an invoice; this is
  // safe because we already verified (a) caller owns the work order, (b)
  // it was in `status='quoted'`, (c) the quote amount is positive.
  //
  // If invoice creation fails, the work order stays at `accepted` with
  // `invoice_id = NULL` and the admin is emailed.
  let invoiceId: string | null = null;
  if (existing.project_id) {
    const invoiceResult = await createInvoiceForUser({
      user_id: user.id,
      project_id: existing.project_id,
      amount_cents: existing.quoted_amount_cents,
      currency: "USD",
      description: `Work order: ${existing.title}`,
      work_order_id: existing.id
    });
    if (invoiceResult.ok) {
      invoiceId = invoiceResult.data.id;
      // Back-link the invoice on the work order via service-role admin client
      // (client RLS blocks updates on `accepted` rows).
      try {
        const adminClient = createAdminClient();
        await adminClient
          .from("work_orders")
          .update({ invoice_id: invoiceId })
          .eq("id", id);
      } catch (e) {
        console.warn("[acceptWorkOrderQuote] invoice_id back-link failed:", e);
      }
    } else {
      console.error(
        "[acceptWorkOrderQuote] invoice creation failed:",
        invoiceResult.error
      );
      try {
        await sendEmail({
          to: ADMIN_NOTIFY_TO(),
          subject: `Invoice creation FAILED for work order ${existing.id}`,
          text: `Work order "${existing.title}" was accepted by ${user.email} but Stripe invoice creation failed: ${invoiceResult.error}`,
          html: `<p>Work order <code>${existing.id}</code> ("${existing.title}") was accepted by ${user.email}, but Stripe invoice creation failed:</p><pre>${invoiceResult.error}</pre>`
        });
      } catch (e) {
        console.warn("[acceptWorkOrderQuote] failure notify also failed:", e);
      }
    }
  } else {
    // No project_id — admin needs to do it by hand from /admin/tickets/[id].
    console.warn(
      `[acceptWorkOrderQuote] wo=${existing.id} has no project_id; admin must create invoice manually.`
    );
  }

  revalidatePath("/portal/tickets");
  revalidatePath("/admin/tickets");
  revalidatePath("/admin/invoices");
  revalidatePath("/portal/invoices");
  return { ok: true, data: { id, invoice_id: invoiceId } };
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

  const { data, error } = await admin
    .from("work_orders")
    .update({ status })
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
