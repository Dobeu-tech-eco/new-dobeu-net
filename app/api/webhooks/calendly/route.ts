import { NextResponse } from "next/server";
import { processLead } from "@/lib/leads";
import { createAdminClient } from "@/lib/supabase/server";
import { logToDatadog } from "@/lib/datadog-server";
import {
  isCalendlyWebhookConfigured,
  verifyCalendlySignature,
  utmFromTracking,
  type CalendlyWebhookEvent
} from "@/lib/calendly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/webhooks/calendly";

/**
 * Datadog logging is best-effort: it must never change the response. Only ids
 * and error metadata go in; never the payload, headers, or the signing key.
 */
async function safely(log: () => Promise<void>): Promise<void> {
  try {
    await log();
  } catch {
    // Non-fatal by design.
  }
}

/**
 * The only error fields that reach Datadog: the error class, the SQLSTATE /
 * PostgREST code, and constraint / table identifiers. The raw message,
 * details, hint and stack are never forwarded because Postgres embeds row
 * values (emails, tokens) in them. Identifiers are pulled out of the message
 * with an identifier-only pattern, so no free text survives.
 */
function safeErrorFields(error: unknown): Record<string, string> {
  const fields: Record<string, string> = {
    kind: error instanceof Error ? error.name : "UnknownError"
  };
  const sources = [error, error instanceof Error ? error.cause : undefined];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const o = source as { code?: unknown; constraint?: unknown; table?: unknown; message?: unknown };
    const text = typeof o.message === "string" ? o.message : "";
    if (!fields.code && typeof o.code === "string" && /^[A-Za-z0-9_]{1,16}$/.test(o.code)) {
      fields.code = o.code;
    }
    const constraint =
      typeof o.constraint === "string" ? o.constraint : /constraint "([A-Za-z0-9_]{1,63})"/.exec(text)?.[1];
    if (!fields.constraint && constraint && /^[A-Za-z0-9_]{1,63}$/.test(constraint)) {
      fields.constraint = constraint;
    }
    const table =
      typeof o.table === "string" ? o.table : /(?:relation|table) "([A-Za-z0-9_.]{1,63})"/.exec(text)?.[1];
    if (!fields.table && table && /^[A-Za-z0-9_.]{1,63}$/.test(table)) {
      fields.table = table;
    }
  }
  return fields;
}

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
  const startedAt = Date.now();
  const requestId = request.headers.get("calendly-request-id") ?? crypto.randomUUID();
  console.log(
    JSON.stringify({
      msg: "calendly_webhook_received",
      request_id: requestId,
      ts: new Date().toISOString()
    })
  );

  if (!isCalendlyWebhookConfigured()) {
    console.warn(
      JSON.stringify({
        msg: "calendly_webhook_not_configured",
        request_id: requestId
      })
    );
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  // Must read the raw body for signature verification (parsing first would break it).
  const rawBody = await request.text();
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY!;
  const valid = verifyCalendlySignature(rawBody, request.headers.get("Calendly-Webhook-Signature"), signingKey);
  if (!valid) {
    await safely(() =>
      logToDatadog("warn", "calendly_webhook_invalid_signature", {
        route: ROUTE,
        request_id: requestId
      })
    );
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let evt: CalendlyWebhookEvent;
  try {
    evt = JSON.parse(rawBody) as CalendlyWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Only act on new bookings; ack everything else so Calendly stops retrying.
  if (evt.event !== "invitee.created") {
    return NextResponse.json({ ok: true, ignored: evt.event });
  }

  const p = evt.payload ?? {};
  if (!p.email) {
    // No email = nothing to upsert. Ack so Calendly doesn't retry a doomed event.
    console.warn("[/api/webhooks/calendly] invitee.created without email — acking");
    return NextResponse.json({ ok: true, skipped: "no_email" });
  }

  let processed: Awaited<ReturnType<typeof processLead>>;
  try {
    processed = await processLead({
      email: p.email,
      name: p.name ?? null,
      source: "book",
      message: p.scheduled_event?.name ? `Booked: ${p.scheduled_event.name}` : null,
      utm: utmFromTracking(p.tracking),
      referrer: p.scheduled_event?.uri ?? null
    });
  } catch (error) {
    await safely(() =>
      logToDatadog("error", "calendly_webhook_processing_failed", {
        route: ROUTE,
        request_id: requestId,
        event_type: evt.event,
        error: safeErrorFields(error)
      })
    );
    // Rethrow: the response is unchanged (unhandled -> 500, Calendly retries).
    throw error;
  }
  const { leadId, apolloContactId } = processed;

  // Keep the bookings table in sync so admin booking views are populated.
  if (p.scheduled_event?.start_time) {
    try {
      const supabase = createAdminClient();
      const { error: insertError } = await supabase.from("bookings").insert({
        lead_id: leadId,
        email: p.email,
        name: p.name ?? null,
        scheduled_at: p.scheduled_event.start_time,
        meeting_url: p.scheduled_event.uri ?? null,
        notes: p.scheduled_event.name ?? null,
        status: "scheduled"
      });
      if (insertError) {
        console.warn("[/api/webhooks/calendly] booking mirror insert failed", insertError.code);
        await safely(() =>
          logToDatadog("error", "calendly_booking_insert_failed", {
            route: ROUTE,
            request_id: requestId,
            lead_id: leadId,
            error: safeErrorFields(insertError)
          })
        );
      }
    } catch (error) {
      console.warn("[/api/webhooks/calendly] booking mirror insert failed", error);
      await safely(() =>
        logToDatadog("error", "calendly_booking_insert_failed", {
          route: ROUTE,
          request_id: requestId,
          lead_id: leadId,
          error: safeErrorFields(error)
        })
      );
    }
  }

  console.log(
    JSON.stringify({
      msg: "calendly_webhook_complete",
      request_id: requestId,
      event_type: evt.event,
      lead_id: leadId,
      duration_ms: Date.now() - startedAt
    })
  );

  return NextResponse.json({ ok: true, lead_id: leadId, apollo_contact_id: apolloContactId });
}
