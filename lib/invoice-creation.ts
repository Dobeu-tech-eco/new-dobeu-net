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
 *   - `acceptWorkOrderQuote` (lib/actions/work-orders.ts) calls this after
 *     verifying the caller owns the quoted work order.
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
      };
    }
  | { ok: false; error: string };

export interface CreateInvoiceForUserInput {
  user_id: string;
  project_id: string;
  amount_cents: number;
  currency: string;
  description?: string | null;
  work_order_id?: string;
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
      amountCents: input.amount_cents,
      currency: input.currency.toLowerCase(),
      description: input.description ?? undefined,
      metadata: {
        supabase_user_id: input.user_id,
        project_id: input.project_id,
        work_order_id: input.work_order_id
      }
    });
    stripeInvoiceId = result.id;
    hostedInvoiceUrl = result.hosted_invoice_url;
  } catch (e) {
    stripeError = e instanceof Error ? e.message : String(e);
    console.error("[createInvoiceForUser] Stripe failure:", stripeError);
  }

  // Persist local row regardless (NULL stripe_invoice_id is the visible
  // signal of a Stripe failure to the admin).
  const { data, error } = await admin
    .from("invoices")
    .insert({
      project_id: input.project_id,
      amount_cents: input.amount_cents,
      currency: input.currency,
      status: "open",
      stripe_invoice_id: stripeInvoiceId,
      hosted_invoice_url: hostedInvoiceUrl
    })
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
    return { ok: false, error: `Stripe error: ${stripeError}` };
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
