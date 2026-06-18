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
  project_id: uuid,
  amount_cents: positiveInt,
  currency: z.string().min(3).max(3).optional().default("USD"),
  description: z.string().trim().max(2000).optional().nullable(),
  work_order_id: uuid.optional()
});

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
    project_id: input.project_id,
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
