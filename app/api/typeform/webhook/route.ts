import { NextResponse } from "next/server";
import { processLead } from "@/lib/leads";
import { isTypeformWebhookConfigured, verifyTypeformSignature } from "@/lib/typeform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TypeformAnswer {
  type?: string;
  text?: string;
  email?: string;
  field?: { id?: string; ref?: string };
}

interface TypeformPayload {
  event_type?: string;
  form_response?: {
    hidden?: Record<string, string | undefined>;
    answers?: TypeformAnswer[];
  };
}

function answerByRef(answers: TypeformAnswer[], refs: string[]): TypeformAnswer | undefined {
  return answers.find((a) => refs.includes(a.field?.ref ?? "") || refs.includes(a.field?.id ?? ""));
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
    console.warn(
      JSON.stringify({ msg: "typeform_webhook_not_configured", request_id: requestId })
    );
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

  const email =
    hidden.email ??
    answerByRef(answers, ["email", "work_email", "business_email"])?.email ??
    answerByRef(answers, ["email", "work_email", "business_email"])?.text;

  if (!email) {
    return NextResponse.json({ ok: true, skipped: "no_email" });
  }

  const name =
    hidden.name ??
    answerByRef(answers, ["name", "full_name", "contact_name"])?.text ??
    null;
  const company =
    hidden.company ??
    answerByRef(answers, ["company", "organization", "business_name"])?.text ??
    null;
  const message =
    answerByRef(answers, ["message", "details", "project_details", "notes"])?.text ?? null;

  const utm: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const) {
    const value = hidden[key];
    if (value) utm[key] = value;
  }

  const { leadId, apolloContactId } = await processLead({
    email,
    name,
    company,
    message,
    source: "typeform",
    utm,
    referrer: hidden.referrer ?? hidden.landing_url ?? null
  });

  console.log(
    JSON.stringify({
      msg: "typeform_webhook_complete",
      request_id: requestId,
      event_type: payload.event_type,
      lead_id: leadId,
      duration_ms: Date.now() - startedAt
    })
  );

  return NextResponse.json({ ok: true, lead_id: leadId, apollo_contact_id: apolloContactId });
}
