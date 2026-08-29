/**
 * Typeform webhook — the entry point for the project scope & estimate intake.
 *
 * Pipeline, in order, every step non-fatal:
 *   verify HMAC -> parse answers -> processLead() -> compute estimate
 *   -> persist + email the estimate
 *
 * The lead is captured even when the client declines the planning-estimate
 * acknowledgement; only the pricing half is skipped in that case.
 */
import { NextResponse } from "next/server";
import { processLead } from "@/lib/leads";
import { isTypeformWebhookConfigured, verifyTypeformSignature } from "@/lib/typeform";
import { computeEstimate } from "@/lib/pricing/estimate";
import { parseIntake } from "@/lib/pricing/intake";
import { persistAndDeliverEstimate } from "@/lib/pricing/estimate-store";
import type { TypeformAnswer } from "@/lib/pricing/typeform-mapping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TypeformPayload {
  event_type?: string;
  form_response?: {
    form_id?: string;
    token?: string;
    hidden?: Record<string, string | undefined>;
    answers?: TypeformAnswer[];
  };
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

function collectUtm(hidden: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    UTM_KEYS.map((key) => [key, hidden[key]]).filter(([, value]) => Boolean(value))
  ) as Record<string, string>;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("typeform-event-id") ?? crypto.randomUUID();
  console.log(
    JSON.stringify({
      msg: "typeform_webhook_received",
      request_id: requestId,
      ts: new Date().toISOString()
    })
  );

  if (!isTypeformWebhookConfigured()) {
    console.warn(JSON.stringify({ msg: "typeform_webhook_not_configured", request_id: requestId }));
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signingSecret = process.env.TYPEFORM_WEBHOOK_SECRET!;
  const valid = verifyTypeformSignature(rawBody, request.headers.get("typeform-signature"), signingSecret);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: TypeformPayload;
  try {
    payload = JSON.parse(rawBody) as TypeformPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (payload.event_type !== "form_response") {
    return NextResponse.json({ ok: true, ignored: payload.event_type ?? "unknown" });
  }

  const hidden = payload.form_response?.hidden ?? {};
  const answers = payload.form_response?.answers ?? [];
  const { contact, estimateInput, narrative, labels, acknowledged } = parseIntake(answers);

  // Hidden fields win over answers: a prefilled email came from a system we
  // already trust, an answered one was typed by hand.
  const email = hidden.email ?? contact.email;
  if (!email) {
    console.warn(JSON.stringify({ msg: "typeform_webhook_no_email", request_id: requestId }));
    return NextResponse.json({ ok: true, skipped: "no_email" });
  }

  const utm = collectUtm(hidden);
  const { leadId, apolloContactId } = await processLead({
    email,
    name: hidden.name ?? contact.name,
    company: hidden.company ?? contact.company,
    message: narrative.projectSummary ?? narrative.currentProblem,
    source: "typeform",
    utm,
    referrer: hidden.referrer ?? hidden.landing_url ?? null
  });

  // The client explicitly declined a planning estimate — capture the lead,
  // skip the pricing. The form routes them to a "let's talk" ending.
  if (!acknowledged) {
    console.log(
      JSON.stringify({
        msg: "typeform_webhook_complete",
        request_id: requestId,
        lead_id: leadId,
        estimate: "declined",
        duration_ms: Date.now() - startedAt
      })
    );
    return NextResponse.json({ ok: true, lead_id: leadId, estimate: "declined" });
  }

  const estimate = computeEstimate(estimateInput);
  const delivery = await persistAndDeliverEstimate({
    contact: { ...contact, email },
    estimate,
    narrative,
    labels,
    inputs: estimateInput,
    leadId,
    formId: payload.form_response?.form_id ?? null,
    responseId: payload.form_response?.token ?? null
  });

  console.log(
    JSON.stringify({
      msg: "typeform_webhook_complete",
      request_id: requestId,
      lead_id: leadId,
      estimate_id: delivery.estimateId,
      estimate_track: estimate.track,
      estimate_mid: estimate.midpoint,
      estimate_confidence: estimate.confidence,
      budget_fit: estimate.budgetFit,
      stored: delivery.stored,
      emailed_client: delivery.emailedClient,
      duration_ms: Date.now() - startedAt
    })
  );

  return NextResponse.json({
    ok: true,
    lead_id: leadId,
    apollo_contact_id: apolloContactId,
    estimate: {
      token: delivery.token,
      low: estimate.low,
      mid: estimate.midpoint,
      high: estimate.high,
      confidence: estimate.confidence
    }
  });
}
