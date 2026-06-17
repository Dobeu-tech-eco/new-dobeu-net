"use server";
/**
 * Invoice admin server actions (Phase 3).
 *
 * Both `createInvoice` and `markInvoicePaidManually` are admin-gated. The
 * actual Stripe-touching code lives in `@/lib/invoice-creation` so that
 * `acceptWorkOrderQuote` (a client-initiated action) can reuse the same
 * core path without dragging the admin guard along.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/actions/auth";
import {
  createInvoiceForUser,
  type InvoiceCreationResult
} from "@/lib/invoice-creation";

const uuid = z.string().uuid("invalid id");
const positiveInt = z
  .number()
  .int("must be an integer")
  .positive("must be > 0")
  .max(1_000_000_000, "absurdly large");

const createInput = z.object({
  user_id: uuid,
  // Optional: work-order invoices may have no project yet. Ownership for those
  // rows is carried by `user_id` (see lib/invoice-creation.ts + RLS).
  project_id: uuid.optional().nullable(),
  amount_cents: positiveInt,
  currency: z.string().min(3).max(3).optional().default("USD"),
  description: z.string().trim().max(2000).optional().nullable(),
  work_order_id: uuid.optional()
});

const createForWorkOrderInput = z.object({ work_order_id: uuid });

const markPaidInput = z.object({ id: uuid });

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createInvoice(raw: unknown): Promise<InvoiceCreationResult> {
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;

  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const result = await createInvoiceForUser({
    user_id: input.user_id,
    project_id: input.project_id ?? null,
    amount_cents: input.amount_cents,
    currency: input.currency,
    description: input.description ?? null,
    work_order_id: input.work_order_id
  });

  revalidatePath("/admin/invoices");
  revalidatePath("/portal/invoices");
  revalidatePath("/admin/tickets");
  revalidatePath("/portal/tickets");
  return result;
}

/**
 * Admin "Create Stripe Invoice" path for an accepted work order.
 *
 * This is the locked Stripe model: the client accepts a quote (which only
 * flips status to `accepted`), then the ADMIN explicitly issues the invoice
 * from /admin/tickets/[id]. Reads the work order via service-role, validates
 * it's `accepted` and not already invoiced, creates the invoice owned by the
 * work order's `created_by` (so the client can see + pay it even with no
 * project), and back-links `work_orders.invoice_id`.
 */
export async function createInvoiceForWorkOrder(
  raw: unknown
): Promise<InvoiceCreationResult> {
  const parsed = createForWorkOrderInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { work_order_id } = parsed.data;

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data: wo, error: readErr } = await admin
    .from("work_orders")
    .select("id,created_by,status,project_id,quoted_amount_cents,title,invoice_id")
    .eq("id", work_order_id)
    .single();

  if (readErr || !wo) return { ok: false, error: readErr?.message ?? "work order not found" };
  if (wo.invoice_id) {
    return { ok: false, error: "work order already has an invoice" };
  }
  if (wo.status !== "accepted") {
    return { ok: false, error: `can only invoice an accepted work order (status="${wo.status}")` };
  }
  if (!wo.quoted_amount_cents || wo.quoted_amount_cents <= 0) {
    return { ok: false, error: "work order has no quote amount" };
  }

  const result = await createInvoiceForUser({
    user_id: wo.created_by,
    project_id: wo.project_id ?? null,
    amount_cents: wo.quoted_amount_cents,
    currency: "USD",
    description: `Work order: ${wo.title}`,
    work_order_id: wo.id
  });

  // Back-link the invoice onto the work order (service-role bypasses RLS).
  if (result.ok) {
    const { error: linkErr } = await admin
      .from("work_orders")
      .update({ invoice_id: result.data.id })
      .eq("id", wo.id);
    if (linkErr) {
      console.error(
        "[createInvoiceForWorkOrder] invoice created but back-link failed:",
        linkErr.message
      );
    }
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/portal/invoices");
  revalidatePath("/admin/tickets");
  revalidatePath("/portal/tickets");
  revalidatePath(`/admin/tickets/${work_order_id}`);
  revalidatePath(`/portal/tickets/${work_order_id}`);
  return result;
}

export async function markInvoicePaidManually(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = markPaidInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { id } = parsed.data;

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { error } = await admin
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/invoices");
  revalidatePath("/portal/invoices");
  return { ok: true, data: { id } };
}
