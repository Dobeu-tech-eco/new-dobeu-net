/**
 * Service-role invoice creation core.
 *
 * Server-only — imported transitively via `@/lib/supabase/server` (which
 * imports `next/headers` and is therefore refused by the client bundler).
 *
 * This module is intentionally NOT a `"use server"` file, so its exports
 * are plain server-only helpers, not server actions that the client could
 * invoke directly. Callers are responsible for their own authorization:
 *
 *   - `createInvoice` (lib/actions/invoices.ts) calls this after `requireAdmin()`.
 *   - `createInvoiceForWorkOrder` (lib/actions/invoices.ts) calls this after
 *     its own admin and linked-invoice checks.
 *
 * Phase 3 locked decisions: Stripe-hosted invoices; lazy-create the Stripe
 * customer on first invoice and stash on profile; mirror the Stripe state
 * onto a local `invoices` row; Stripe failure still inserts a local row
 * (NULL `stripe_invoice_id`) so the admin sees the attempt.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { getOrCreateStripeCustomer, createHostedInvoice } from "@/lib/stripe";
import { sendEmail } from "@/lib/resend";
import { invoiceReadyToClient } from "@/lib/resend-templates";

export type InvoiceCreationResult =
  | {
      ok: true;
      data: {
        id: string;
        stripe_invoice_id: string | null;
        hosted_invoice_url: string | null;
        /** True when Stripe returned an invoice we already recorded locally. */
        reused?: true;
      };
    }
  // `localInvoiceId` is set only on a Stripe failure: the local row exists.
  | { ok: false; error: string; localInvoiceId?: string };

export interface CreateInvoiceForUserInput {
  user_id: string;
  /**
   * Optional. Work-order invoices may have no project yet — in that case the
   * row is owned via `invoices.user_id` (= the work order's `created_by`) so
   * RLS still lets the client see + pay it.
   */
  project_id?: string | null;
  amount_cents: number;
  currency: string;
  description?: string | null;
  work_order_id?: string;
}

export const STRIPE_VOID_STEP =
  "void it in the Stripe dashboard (find that invoice on /admin/invoices; the row's Stripe link or dashboard link opens it)";

/**
 * Refusal for a work order whose linked (or audited) invoice is not void. One
 * message for one condition: shared by the admin actions' gate and this
 * helper's own re-check.
 */
export function alreadyInvoicedMessage(invoiceId: string): string {
  return `Invoice ${invoiceId} is already billed for this work order. To bill again, ${STRIPE_VOID_STEP}; once the webhook marks it void, this work order can be billed again.`;
}

/**
 * Stripe idempotency key for a work-order invoice. The first bill uses `v1`;
 * a re-bill after a void uses the replaced invoice's id so Stripe sees a new key.
 */
export function workOrderInvoiceIdempotencyKey(
  workOrderId: string,
  replacedInvoiceId: string | null
): string {
  return `work-order-invoice:${workOrderId}:${replacedInvoiceId ?? "v1"}`;
}

export async function createInvoiceForUser(
  input: CreateInvoiceForUserInput
): Promise<InvoiceCreationResult> {
  const admin = createAdminClient();

  // Resolve recipient (email is required for Stripe customer mapping).
  let recipientEmail: string | null = null;
  let recipientName: string | null = null;
  try {
    const { data: userRes } = await admin.auth.admin.getUserById(input.user_id);
    recipientEmail = userRes?.user?.email ?? null;
    recipientName =
      (userRes?.user?.user_metadata as { full_name?: string } | null)?.full_name ?? null;
  } catch (e) {
    return {
      ok: false,
      error: `unable to resolve user ${input.user_id}: ${e instanceof Error ? e.message : String(e)}`
    };
  }
  if (!recipientEmail) {
    return { ok: false, error: `user ${input.user_id} has no email on file` };
  }
  if (!recipientName) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", input.user_id)
      .single();
    recipientName = profile?.full_name ?? null;
  }

  // For a work-order invoice, read the work order's current invoice link
  // BEFORE any Stripe call. Callers check the linked invoice too, but those
  // checks can be stale under concurrent billing (another request may have
  // finished and back-linked a new invoice since), so this helper re-checks:
  // a linked invoice must be void, and it is then the invoice being replaced.
  // Fail closed: these errors deliberately do not start with "Stripe error:",
  // which callers read as "a local row exists".
  let replacedInvoiceId: string | null = null;
  if (input.work_order_id) {
    const { data: wo, error: woErr } = await admin
      .from("work_orders")
      .select("invoice_id")
      .eq("id", input.work_order_id)
      .single();
    if (woErr || !wo) {
      return { ok: false, error: "Unable to read the work order's current invoice link" };
    }
    replacedInvoiceId = wo.invoice_id ?? null;
    if (replacedInvoiceId) {
      const { data: linked, error: linkedErr } = await admin
        .from("invoices")
        .select("status")
        .eq("id", replacedInvoiceId)
        .single();
      if (linkedErr || !linked) {
        return { ok: false, error: "Unable to read the work order's current invoice link" };
      }
      if (linked.status !== "void") {
        return { ok: false, error: alreadyInvoicedMessage(replacedInvoiceId) };
      }
    }
  }

  // Stripe-hosted invoice flow.
  let stripeInvoiceId: string | null = null;
  let hostedInvoiceUrl: string | null = null;
  let stripeError: string | null = null;
  try {
    const customerId = await getOrCreateStripeCustomer({
      supabaseUserId: input.user_id,
      email: recipientEmail,
      name: recipientName
    });
    const result = await createHostedInvoice({
      customerId,
      // Stripe retains keys for ~24h and rejects a reused key whose parameters
      // differ. The key includes the invoice being replaced so a re-bill after
      // a void (possibly with a new amount) gets a fresh key, while a retry of
      // the same attempt (link unchanged) reuses the same key. Durable
      // reservation is still required to protect retries after that window or
      // after local failures.
      //
      // Known gap: after an `invoice.link_failed`, `work_orders.invoice_id`
      // still points at the OLDER invoice, so a re-bill after voiding the
      // newer invoice reuses the older key. With the same amount, Stripe
      // replays the voided invoice and the "Stripe returned a voided invoice"
      // branch below refuses. With a different amount, Stripe rejects the
      // reused key ("Stripe error:", unsent row) and this case is NOT covered.
      idempotencyKey: input.work_order_id
        ? workOrderInvoiceIdempotencyKey(input.work_order_id, replacedInvoiceId)
        : undefined,
      amountCents: input.amount_cents,
      currency: input.currency.toLowerCase(),
      description: input.description ?? undefined,
      metadata: {
        supabase_user_id: input.user_id,
        project_id: input.project_id ?? undefined,
        work_order_id: input.work_order_id
      }
    });
    stripeInvoiceId = result.id;
    hostedInvoiceUrl = result.hosted_invoice_url;
  } catch (e) {
    stripeError = e instanceof Error ? e.message : String(e);
    console.error("[createInvoiceForUser] Stripe failure:", stripeError);
  }

  // Defence in depth: Stripe's idempotency key returns the SAME invoice on a
  // repeat call for a work order. If that invoice is already recorded locally,
  // do not insert (or email) a second row; report the existing one.
  if (stripeInvoiceId && input.work_order_id) {
    const { data: existing, error: existingErr } = await admin
      .from("invoices")
      .select("id,hosted_invoice_url,status")
      .eq("stripe_invoice_id", stripeInvoiceId)
      .limit(10);
    if (existingErr) {
      return { ok: false, error: "Unable to check for an existing invoice record" };
    }
    const row = existing?.find((r) => r.status !== "void");
    if (!row && existing?.length) {
      return {
        ok: false,
        error:
          "Stripe returned a voided invoice for this work order; wait 24h, then try again"
      };
    }
    if (row) {
      return {
        ok: true,
        data: {
          id: row.id,
          stripe_invoice_id: stripeInvoiceId,
          hosted_invoice_url: row.hosted_invoice_url ?? hostedInvoiceUrl,
          reused: true
        }
      };
    }
  }

  // Persist local row regardless (NULL stripe_invoice_id is the visible
  // signal of a Stripe failure to the admin).
  //
  // `user_id` is ALWAYS populated so the new RLS branch (user_id = auth.uid())
  // makes the invoice visible to the client even when `project_id` is NULL.
  const invoiceRow = {
    project_id: input.project_id ?? null,
    user_id: input.user_id,
    amount_cents: input.amount_cents,
    currency: input.currency,
    status: "open" as const,
    stripe_invoice_id: stripeInvoiceId,
    hosted_invoice_url: hostedInvoiceUrl
  };
  const { data, error } = await admin
    .from("invoices")
    .insert(invoiceRow)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert failed" };
  }

  if (hostedInvoiceUrl) {
    try {
      const tpl = invoiceReadyToClient({
        invoice: { id: data.id, amount_cents: input.amount_cents, currency: input.currency },
        hostedUrl: hostedInvoiceUrl,
        description: input.description ?? null
      });
      await sendEmail({ to: recipientEmail, subject: tpl.subject, text: tpl.text, html: tpl.html });
    } catch (e) {
      console.warn("[createInvoiceForUser] invoice-ready email failed (non-fatal):", e);
    }
  }

  if (stripeError) {
    return { ok: false, error: `Stripe error: ${stripeError}`, localInvoiceId: data.id };
  }

  return {
    ok: true,
    data: {
      id: data.id,
      stripe_invoice_id: stripeInvoiceId,
      hosted_invoice_url: hostedInvoiceUrl
    }
  };
}
