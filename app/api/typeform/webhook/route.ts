import { NextResponse } from "next/server";
import type { Json } from "@/lib/database.types";
import { logToDatadog } from "@/lib/datadog-server";
import {
  isTypeformWebhookConfigured,
  verifyTypeformSignature,
} from "@/lib/typeform";
import {
  isTypeformBudgetFormConfigurationConsistent,
  persistTypeformBudgetIntake,
  TYPEFORM_BUDGET_FORM_ID,
  TypeformBudgetIntakeValidationError,
  type TypeformBudgetWebhookPayload,
} from "@/lib/typeform-budget-intake";
import {
  readTypeformWebhookBody,
  TypeformWebhookBodyTooLargeError,
} from "@/lib/typeform-webhook-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/typeform/webhook";

/**
 * Datadog logging is best-effort: it must never change the response. Only ids
 * and error metadata go in; never the payload, headers, or the webhook secret.
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
    kind: error instanceof Error ? error.name : "UnknownError",
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

function invalidFormResponse(detail: string) {
  return NextResponse.json(
    { ok: false, error: "invalid_form_response", detail },
    { status: 422 },
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId =
    request.headers.get("typeform-event-id") ?? crypto.randomUUID();
  console.log(
    JSON.stringify({
      msg: "typeform_webhook_received",
      request_id: requestId,
      ts: new Date().toISOString(),
    }),
  );

  if (!isTypeformWebhookConfigured()) {
    console.warn(
      JSON.stringify({
        msg: "typeform_webhook_not_configured",
        request_id: requestId,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  if (!isTypeformBudgetFormConfigurationConsistent()) {
    console.error(
      JSON.stringify({
        msg: "typeform_budget_form_configuration_mismatch",
        request_id: requestId,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "form_configuration_mismatch" },
      { status: 503 },
    );
  }

  let rawBodyBytes: Uint8Array;
  try {
    rawBodyBytes = await readTypeformWebhookBody(request);
  } catch (error) {
    if (error instanceof TypeformWebhookBodyTooLargeError) {
      return NextResponse.json(
        { ok: false, error: "payload_too_large" },
        { status: 413 },
      );
    }
    throw error;
  }

  const signingSecret = process.env.TYPEFORM_WEBHOOK_SECRET!;
  const valid = verifyTypeformSignature(
    rawBodyBytes,
    request.headers.get("typeform-signature"),
    signingSecret,
  );
  if (!valid) {
    await safely(() =>
      logToDatadog("warn", "typeform_webhook_invalid_signature", {
        route: ROUTE,
        request_id: requestId,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 },
    );
  }

  let rawBody: string;
  try {
    rawBody = new TextDecoder("utf-8", { fatal: true }).decode(rawBodyBytes);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_encoding" },
      { status: 400 },
    );
  }

  let payload: TypeformBudgetWebhookPayload;
  let rawPayload: Json;
  try {
    const parsed = JSON.parse(rawBody) as Json;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload" },
        { status: 400 },
      );
    }
    rawPayload = parsed;
    payload = rawPayload as unknown as TypeformBudgetWebhookPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  if (payload.event_type !== "form_response") {
    return NextResponse.json({
      ok: true,
      ignored:
        typeof payload.event_type === "string" ? payload.event_type : "unknown",
    });
  }

  const formId =
    typeof payload.form_response?.form_id === "string"
      ? payload.form_response.form_id.trim()
      : "";
  if (!formId) {
    return invalidFormResponse("missing_form_id");
  }

  if (formId !== TYPEFORM_BUDGET_FORM_ID) {
    return NextResponse.json({ ok: true, ignored: "unconfigured_form" });
  }

  const responseToken =
    typeof payload.form_response?.token === "string"
      ? payload.form_response.token.trim()
      : "";
  if (!responseToken) {
    return invalidFormResponse("missing_response_token");
  }
  if (!Array.isArray(payload.form_response?.answers)) {
    return invalidFormResponse("missing_answers");
  }

  try {
    const intake = await persistTypeformBudgetIntake(
      payload,
      rawPayload,
      request.headers.get("typeform-event-id"),
    );

    console.log(
      JSON.stringify({
        msg: "typeform_budget_intake_complete",
        request_id: requestId,
        intake_id: intake.id,
        duplicate: intake.duplicate,
        mapping_status: intake.mappingStatus,
        duration_ms: Date.now() - startedAt,
      }),
    );

    return NextResponse.json({
      ok: true,
      intake_id: intake.id,
      duplicate: intake.duplicate,
      mapping_status: intake.mappingStatus,
      mapping_warnings: intake.mappingWarnings,
    });
  } catch (error) {
    if (error instanceof TypeformBudgetIntakeValidationError) {
      return invalidFormResponse(error.message);
    }

    console.error(
      JSON.stringify({
        msg: "typeform_budget_intake_storage_failed",
        request_id: requestId,
        duration_ms: Date.now() - startedAt,
      }),
    );
    await safely(() =>
      logToDatadog("error", "typeform_budget_intake_storage_failed", {
        route: ROUTE,
        request_id: requestId,
        form_id: formId,
        error: safeErrorFields(error),
      }),
    );
    return NextResponse.json(
      { ok: false, error: "storage_unavailable" },
      { status: 503 },
    );
  }
}
