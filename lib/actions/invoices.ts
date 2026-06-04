"use server";
/**
 * Invoice admin server actions (Phase 2).
 *
 * Per PRODUCTION-PLAN §5 Phase 3: the actual Stripe API call (create
 * `stripe_invoice_id` + `hosted_invoice_url`) lands in Phase 3. This file
 * scaffolds the DB-only surface so Phase 3 just has to add the Stripe step
 * in front of the existing insert path.
 *
 * `markInvoicePaidManually` handles the realistic edge case where a client
 * pays by cash/check/wire outside Stripe and the admin needs to flip status
 * by hand. Stripe-webhook-driven status flips are Phase 3.
 *
 * Note: `invoices.project_id` is NOT NULL per the initial schema; the
 * production plan's `createInvoice({ user_id, project_id, amount_cents,
 * description })` shape includes `user_id` for forward-compat (a future
 * orphan-invoice migration), but for now we require `project_id`. The
 * `description` field doesn't exist as an `invoices` column either; we
 * stash it into the action result for downstream Stripe wiring (Phase 3
 * will pass it to Stripe.invoices.create() as `description`).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/actions/auth";

const uuid = z.string().uuid("invalid id");
const positiveInt = z
  .number()
  .int("must be an integer")
  .positive("must be > 0")
  .max(1_000_000_000, "absurdly large");

const createInput = z.object({
  // user_id is captured for the Phase 3 Stripe customer mapping but is not
  // persisted as an invoices column (invoices link to projects, not users).
  user_id: uuid,
  project_id: uuid,
  amount_cents: positiveInt,
  currency: z.string().min(3).max(3).optional().default("USD"),
  description: z.string().trim().max(2000).optional().nullable()
});

const markPaidInput = z.object({ id: uuid });

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createInvoice(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;

  let admin;
  try {
    ({ admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data, error } = await admin
    .from("invoices")
    .insert({
      project_id: input.project_id,
      amount_cents: input.amount_cents,
      currency: input.currency,
      status: "open",
      stripe_invoice_id: null,
      hosted_invoice_url: null
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  // PHASE 3: call Stripe.invoices.create({ customer, amount, description })
  //          then update invoices row with stripe_invoice_id + hosted_invoice_url.
  // For now, description is intentionally not persisted (no column for it yet);
  // Phase 3 will either add a column or rely on Stripe holding the description.
  void input.user_id;
  void input.description;

  revalidatePath("/admin/invoices");
  revalidatePath("/portal/invoices");
  return { ok: true, data: { id: data.id } };
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
