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

const ADMIN_NOTIFY_TO = (): string =>
  process.env.RESEND_REPLY_TO ?? "jeremyw@dobeu.net";

interface InvoiceRow {
  id: string;
  project_id: string;
  amount_cents: number;
  currency: string | null;
  status: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = request.headers.get("stripe-request-id") ?? crypto.randomUUID();

  console.log(
    JSON.stringify({
      msg: "stripe_webhook_received",
      request_id: requestId,
      ts: new Date().toISOString()
    })
  );

  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, sig);
  } catch (e) {
    console.warn(
      JSON.stringify({
        msg: "stripe_webhook_invalid_signature",
        request_id: requestId,
        error: e instanceof Error ? e.message : String(e)
      })
    );
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
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
        // The .neq("status","paid") guard makes this idempotent across
        // instances: the in-memory event dedupe (lib/stripe-event-dedupe.ts)
        // only protects a single instance, and Stripe delivers at-least-once.
        // A repeat delivery of an already-paid invoice now matches 0 rows ->
        // row is null -> notifyInvoicePaid no-ops, instead of re-sending the
        // "paid" receipt email on every redelivery.
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id) {
          const { data: row } = await admin
            .from("invoices")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("stripe_invoice_id", inv.id)
            .neq("status", "paid")
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
        // status just keeps the dashboard honest. Same idempotency guard as
        // invoice.paid above -- a repeat delivery of an already-overdue
        // invoice no-ops instead of re-sending the admin alert.
        const inv = event.data.object as Stripe.Invoice;
        if (inv.id) {
          const { data: row } = await admin
            .from("invoices")
            .update({ status: "overdue" })
            .eq("stripe_invoice_id", inv.id)
            .neq("status", "overdue")
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
    console.error(
      JSON.stringify({
        msg: "stripe_webhook_handler_error",
        request_id: requestId,
        event_id: event.id,
        event_type: event.type,
        error: e instanceof Error ? e.message : String(e)
      })
    );
    // Removing the event from the dedupe set lets Stripe retry. Errors are
    // worth retrying (transient DB, transient Resend) far more often than
    // they aren't.
    forgetStripeEvent(event.id);
    return NextResponse.json({ ok: false, error: "handler_error" }, { status: 500 });
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

async function notifyInvoicePaid(
  admin: ReturnType<typeof createAdminClient>,
  stripeInv: Stripe.Invoice,
  row: InvoiceRow | null
): Promise<void> {
  if (!row) return;
  const recipient = stripeInv.customer_email ?? null;
  if (!recipient) return;
  try {
    const tpl = invoicePaidToClient({
      invoice: {
        id: row.id,
        amount_cents: row.amount_cents,
        currency: row.currency ?? "USD"
      },
      description: stripeInv.description ?? null
    });
    await sendEmail({ to: recipient, subject: tpl.subject, text: tpl.text, html: tpl.html });
  } catch (e) {
    console.warn("[stripe webhook] invoice.paid email failed (non-fatal):", e);
  }
  void admin; // reserved for future per-project owner lookup
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
