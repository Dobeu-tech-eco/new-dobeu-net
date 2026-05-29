import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isStripeConfigured, verifyWebhook } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver. Verifies the `Stripe-Signature` HMAC before
 * trusting any payload. Subscribes (via the Stripe dashboard or the
 * Composio Stripe connector) to at minimum:
 *   - invoice.paid
 *   - invoice.payment_failed
 *   - invoice.marked_uncollectible
 *   - invoice.finalized
 *
 * Mirrors /api/webhooks/calendly's posture: returns 503 when env unset so
 * Stripe stops retrying instead of silently accepting unsigned calls.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("[/api/webhooks/stripe] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET unset — ignoring webhook");
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const evt = verifyWebhook(rawBody, request.headers.get("stripe-signature"));
  if (!evt) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  try {
    switch (evt.type) {
      case "invoice.paid":
        await updateInvoiceStatus(evt.data.object as Stripe.Invoice, "paid");
        break;
      case "invoice.payment_failed":
      case "invoice.marked_uncollectible":
        await updateInvoiceStatus(evt.data.object as Stripe.Invoice, "overdue");
        break;
      case "invoice.finalized":
        // Capture hosted_invoice_url if it landed after our own create call.
        await syncHostedUrl(evt.data.object as Stripe.Invoice);
        break;
      default:
        // Ignore everything else but ack so Stripe stops retrying.
        break;
    }
  } catch (e) {
    console.error("[/api/webhooks/stripe] handler error", e);
    // Returning 500 prompts Stripe to retry; that's the right call for transient
    // Supabase failures. Signature already verified by this point.
    return NextResponse.json({ ok: false, error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type: evt.type });
}

async function updateInvoiceStatus(invoice: Stripe.Invoice, status: "paid" | "overdue") {
  if (!invoice.id) return;
  const supa = createAdminClient();
  const patch: { status: "paid" | "overdue"; paid_at?: string } = { status };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  await supa.from("invoices").update(patch).eq("stripe_invoice_id", invoice.id);
}

async function syncHostedUrl(invoice: Stripe.Invoice) {
  if (!invoice.id || !invoice.hosted_invoice_url) return;
  const supa = createAdminClient();
  await supa
    .from("invoices")
    .update({ hosted_invoice_url: invoice.hosted_invoice_url })
    .eq("stripe_invoice_id", invoice.id);
}
