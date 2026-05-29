import { NextResponse } from "next/server";
import { processLead } from "@/lib/leads";
import {
  isCalendlyWebhookConfigured,
  verifyCalendlySignature,
  utmFromTracking,
  type CalendlyWebhookEvent,
} from "@/lib/calendly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Calendly webhook receiver. Calendly's `invitee.created` payload DOES carry the
 * invitee email/name (unlike the client-side embed event), so this is where the
 * booking actually becomes a lead in Supabase + Apollo + Customer.io + Resend.
 *
 * Setup (one-time, outside the app):
 *  1. Set CALENDLY_WEBHOOK_SIGNING_KEY (and optionally CALENDLY_API_TOKEN).
 *  2. Create a webhook subscription pointing at /api/webhooks/calendly for the
 *     `invitee.created` event via Calendly's API.
 */
export async function POST(request: Request) {
  if (!isCalendlyWebhookConfigured()) {
    // Inert until configured — mirrors the rest of the env-gated pipeline.
    console.warn(
      "[/api/webhooks/calendly] CALENDLY_WEBHOOK_SIGNING_KEY unset — ignoring webhook",
    );
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  // Must read the raw body for signature verification (parsing first would break it).
  const rawBody = await request.text();
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY!;
  const valid = verifyCalendlySignature(
    rawBody,
    request.headers.get("Calendly-Webhook-Signature"),
    signingKey,
  );
  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 },
    );
  }

  let evt: CalendlyWebhookEvent;
  try {
    evt = JSON.parse(rawBody) as CalendlyWebhookEvent;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  // Only act on new bookings; ack everything else so Calendly stops retrying.
  if (evt.event !== "invitee.created") {
    return NextResponse.json({ ok: true, ignored: evt.event });
  }

  const p = evt.payload ?? {};
  if (!p.email) {
    // No email = nothing to upsert. Ack so Calendly doesn't retry a doomed event.
    console.warn(
      "[/api/webhooks/calendly] invitee.created without email — acking",
    );
    return NextResponse.json({ ok: true, skipped: "no_email" });
  }

  const { leadId, apolloContactId } = await processLead({
    email: p.email,
    name: p.name ?? null,
    source: "book",
    message: p.scheduled_event?.name
      ? `Booked: ${p.scheduled_event.name}`
      : null,
    utm: utmFromTracking(p.tracking),
    referrer: p.scheduled_event?.uri ?? null,
  });

  return NextResponse.json({
    ok: true,
    lead_id: leadId,
    apollo_contact_id: apolloContactId,
  });
}
