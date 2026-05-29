/**
 * Calendly webhook helpers.
 *
 * Calendly signs each webhook with an HMAC-SHA256 over `${t}.${rawBody}` and
 * sends it in the `Calendly-Webhook-Signature: t=<unix>,v1=<hex>` header. We
 * verify that signature before trusting any payload. Everything is gated on
 * CALENDLY_WEBHOOK_SIGNING_KEY — if it's unset the route treats the integration
 * as not configured (it never silently accepts unsigned requests).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function isCalendlyWebhookConfigured(): boolean {
  return Boolean(process.env.CALENDLY_WEBHOOK_SIGNING_KEY);
}

/** Parse a `t=...,v1=...` Calendly signature header into its parts. */
export function parseCalendlySignature(
  header: string | null,
): { t: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  if (!parts.t || !parts.v1) return null;
  return { t: parts.t, v1: parts.v1 };
}

/**
 * Verify a Calendly webhook signature.
 *
 * @param rawBody       the exact request body string (must be unparsed)
 * @param header        the `Calendly-Webhook-Signature` header value
 * @param signingKey    CALENDLY_WEBHOOK_SIGNING_KEY
 * @param toleranceSec  reject signatures older than this (default 300s) to blunt replay
 */
export function verifyCalendlySignature(
  rawBody: string,
  header: string | null,
  signingKey: string,
  toleranceSec = 300,
): boolean {
  const parsed = parseCalendlySignature(header);
  if (!parsed) return false;

  const expected = createHmac("sha256", signingKey)
    .update(`${parsed.t}.${rawBody}`)
    .digest("hex");

  // Constant-time compare; bail if lengths differ (timingSafeEqual throws otherwise).
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parsed.v1, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  // Replay guard: reject stale timestamps.
  const ts = Number(parsed.t);
  if (!Number.isFinite(ts)) return false;
  const ageSec = Math.abs(Date.now() / 1000 - ts);
  return ageSec <= toleranceSec;
}

// ---- payload shapes (the subset we use from invitee.created) ----

export interface CalendlyInviteeCreatedPayload {
  email?: string;
  name?: string;
  scheduled_event?: {
    uri?: string;
    name?: string;
    start_time?: string;
    end_time?: string;
    location?: { type?: string; location?: string; join_url?: string };
  };
  tracking?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
  };
}

export interface CalendlyWebhookEvent {
  event: string;
  payload: CalendlyInviteeCreatedPayload;
}

/** Map Calendly's `tracking` block to our flat utm record, dropping nulls. */
export function utmFromTracking(
  tracking?: CalendlyInviteeCreatedPayload["tracking"],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!tracking) return out;
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ] as const) {
    const v = tracking[k];
    if (v) out[k] = v;
  }
  return out;
}
