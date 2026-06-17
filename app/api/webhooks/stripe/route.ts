/**
 * Stripe webhook receiver (Phase 3).
 *
 * Local invoice state is fully driven by Stripe events. We never optimistically
 * mark a row paid from the UI — every status flip lands here through a signed
 * Stripe POST. The only escape hatch is `markInvoicePaidManually` for cash/wire.
 *
 * Events handled:
 *   invoice.paid           → status='paid',   paid_at=now()   (+ client receipt email)
 *   invoice.payment_failed → status='failed'                  (+ admin notification email)
 *   invoice.finalized      → mirror hosted_invoice_url        (re-finalization can change it)
 *   invoice.voided         → status='void'
 *
 * Everything else is acked with `200 { received: true, ignored }` so Stripe
 * stops retrying — Stripe expects 2xx for "received and acknowledged", not
 * "acted on".
 *
 * Idempotency: webhook delivery is at-least-once. We dedupe per `event.id`
 * with a small in-memory LRU (good enough for serverless single-region) AND
 * the underlying UPDATE is naturally idempotent (mirror-of-target-state).
 *
 * Runtime constraint: nodejs (Stripe SDK does not run on edge).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/stripe";
import { forgetStripeEvent, rememberStripeEvent } from "@/lib/stripe-event-dedupe";
import { sendEmail } from "@/lib/resend";
import {
  invoicePaidToClient,
  invoicePaymentFailedToAdmin
} from "@/lib/resend-templates";
import type Stripe from "stripe";

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
    console.warn(
      "[/api/webhooks/stripe] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET unset — ignoring webhook",
    );
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const evt = verifyWebhook(rawBody, request.headers.get("stripe-signature"));
  if (!evt) {
    return NextResponse.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 },
    );
  }

  if (rememberStripeEvent(event.id)) {
    console.log(
      JSON.stringify({
        msg: "stripe_webhook_duplicate",
        request_id: requestId,
        event_id: event.id,
        event_type: event.type
      })
    );
    return NextResponse.json({ received: true, deduped: true });
  }

  console.log(
    JSON.stringify({
      msg: "stripe_webhook_verified",
      request_id: requestId,
      event_id: event.id,
      event_type: event.type
    })
  );

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id) {
          const { data: row } = await admin
            .from("invoices")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("stripe_invoice_id", inv.id)
            .select("id,project_id,amount_cents,currency,status")
            .single();

          await notifyInvoicePaid(admin, inv, row as InvoiceRow | null);
        }
        break;
      }

      case "invoice.payment_failed": {
        // Schema enum (invoice_status) doesn't have 'failed'/'uncollectible'
        // -- 'overdue' is the closest semantic match (invoice didn't get
        // paid). The admin email is the operational signal; the local row's
        // status just keeps the dashboard honest.
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id) {
          const { data: row } = await admin
            .from("invoices")
            .update({ status: "overdue" })
            .eq("stripe_invoice_id", inv.id)
            .select("id,project_id,amount_cents,currency,status")
            .single();

          await notifyInvoiceFailed(inv, row as InvoiceRow | null);
        }
        break;
      }

      case "invoice.finalized": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id && inv.hosted_invoice_url) {
          await admin
            .from("invoices")
            .update({ hosted_invoice_url: inv.hosted_invoice_url })
            .eq("stripe_invoice_id", inv.id);
        }
        break;
      }

      case "invoice.voided": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id) {
          await admin
            .from("invoices")
            .update({ status: "void" })
            .eq("stripe_invoice_id", inv.id);
        }
        break;
      }

      default:
        console.log(
          JSON.stringify({
            msg: "stripe_webhook_ignored",
            request_id: requestId,
            event_id: event.id,
            event_type: event.type
          })
        );
        break;
    }
  } catch (e) {
    console.error("[/api/webhooks/stripe] handler error", e);
    // Returning 500 prompts Stripe to retry; that's the right call for transient
    // Supabase failures. Signature already verified by this point.
    return NextResponse.json(
      { ok: false, error: "handler_error" },
      { status: 500 },
    );
  }

  console.log(
    JSON.stringify({
      msg: "stripe_webhook_complete",
      request_id: requestId,
      event_id: event.id,
      event_type: event.type,
      duration_ms: Date.now() - startedAt
    })
  );

  return NextResponse.json({ received: true });
}

async function updateInvoiceStatus(
  invoice: Stripe.Invoice,
  status: "paid" | "overdue",
) {
  if (!invoice.id) return;
  const supa = createAdminClient();
  const patch: { status: "paid" | "overdue"; paid_at?: string } = { status };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  await supa.from("invoices").update(patch).eq("stripe_invoice_id", invoice.id);
}

async function notifyInvoiceFailed(
  stripeInv: Stripe.Invoice,
  row: InvoiceRow | null
): Promise<void> {
  try {
    const tpl = invoicePaymentFailedToAdmin({
      invoice: row
        ? {
            id: row.id,
            amount_cents: row.amount_cents,
            currency: row.currency ?? "USD"
          }
        : {
            id: stripeInv.id ?? "(no local row)",
            amount_cents: stripeInv.amount_due ?? 0,
            currency: (stripeInv.currency ?? "usd").toUpperCase()
          },
      stripeInvoiceId: stripeInv.id ?? null
    });
    await sendEmail({
      to: ADMIN_NOTIFY_TO(),
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html
    });
  } catch (e) {
    console.warn("[stripe webhook] invoice.payment_failed email failed (non-fatal):", e);
  }
}
