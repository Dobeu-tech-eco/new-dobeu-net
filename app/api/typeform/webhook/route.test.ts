import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("@/lib/leads", () => ({
  processLead: vi
    .fn()
    .mockResolvedValue({ leadId: "lead_tf_1", apolloContactId: "apollo_tf_1" }),
}));

vi.mock("@/lib/typeform-budget-intake", () => {
  class TypeformBudgetIntakeValidationError extends Error {}
  return {
    TYPEFORM_BUDGET_FORM_ID: "wKVKIBe7",
    TypeformBudgetIntakeValidationError,
    isTypeformBudgetFormConfigurationConsistent: vi.fn(),
    persistTypeformBudgetIntake: vi.fn(),
  };
});

import { POST } from "@/app/api/typeform/webhook/route";
import { processLead } from "@/lib/leads";
import {
  isTypeformBudgetFormConfigurationConsistent,
  persistTypeformBudgetIntake,
} from "@/lib/typeform-budget-intake";
import { TYPEFORM_WEBHOOK_MAX_BYTES } from "@/lib/typeform-webhook-body";

const mockedProcessLead = vi.mocked(processLead);
const mockedPersistBudgetIntake = vi.mocked(persistTypeformBudgetIntake);
const mockedFormConfigurationConsistent = vi.mocked(
  isTypeformBudgetFormConfigurationConsistent,
);
const SECRET = "typeform-secret";
const BUDGET_FORM_ID = "wKVKIBe7";

function sign(rawBody: string | Uint8Array, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("base64")}`;
}

function makeRequest(
  rawBody: string,
  signature?: string | null,
  eventId?: string,
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (signature) headers["typeform-signature"] = signature;
  if (eventId) headers["typeform-event-id"] = eventId;
  return new Request("http://localhost/api/typeform/webhook", {
    method: "POST",
    body: rawBody,
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedProcessLead.mockResolvedValue({
    leadId: "lead_tf_1",
    apolloContactId: "apollo_tf_1",
  });
  mockedPersistBudgetIntake.mockResolvedValue({
    id: "intake_budget_1",
    duplicate: false,
    mappingStatus: "mapped",
    mappingWarnings: [],
  });
  mockedFormConfigurationConsistent.mockReturnValue(true);
  process.env.TYPEFORM_WEBHOOK_SECRET = SECRET;
});

describe("POST /api/typeform/webhook", () => {
  it("returns 503 when webhook secret is missing", async () => {
    delete process.env.TYPEFORM_WEBHOOK_SECRET;
    const body = JSON.stringify({
      event_type: "form_response",
      form_response: {},
    });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
  });

  it("fails closed when the deployed public form ID drifts", async () => {
    mockedFormConfigurationConsistent.mockReturnValue(false);
    const body = JSON.stringify({
      event_type: "form_response",
      form_response: { form_id: BUDGET_FORM_ID },
    });

    const res = await POST(makeRequest(body, sign(body)));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      ok: false,
      error: "form_configuration_mismatch",
    });
    expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("returns 401 on invalid signature", async () => {
    const body = JSON.stringify({
      event_type: "form_response",
      form_response: {},
    });
    const res = await POST(makeRequest(body, sign(body, "wrong")));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_signature" });
  });

  it("rejects an oversized declared body before signature verification", async () => {
    const request = makeRequest("{}", null);
    request.headers.set(
      "content-length",
      String(TYPEFORM_WEBHOOK_MAX_BYTES + 1),
    );

    const res = await POST(request);

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      ok: false,
      error: "payload_too_large",
    });
    expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("caps a streamed body when Content-Length is absent", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode("x".repeat(TYPEFORM_WEBHOOK_MAX_BYTES)),
        );
        controller.enqueue(encoder.encode("x"));
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/typeform/webhook", {
      method: "POST",
      body: stream,
      headers: { "content-type": "application/json" },
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect(request.headers.get("content-length")).toBeNull();

    const res = await POST(request);

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      ok: false,
      error: "payload_too_large",
    });
    expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON after verifying the raw body", async () => {
    const body = "{not-json";
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_json" });
    expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("verifies exact bytes before rejecting invalid UTF-8", async () => {
    const body = new Uint8Array([0xff]);
    const res = await POST(
      new Request("http://localhost/api/typeform/webhook", {
        method: "POST",
        body,
        headers: {
          "content-type": "application/json",
          "typeform-signature": sign(body),
        },
      }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "invalid_encoding",
    });
    expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("returns 400 for valid JSON that is not an event object", async () => {
    const body = "null";
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: "invalid_payload",
    });
    expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("returns 422 for a form_response without a concrete form ID", async () => {
    const body = JSON.stringify({
      event_type: "form_response",
      form_response: { token: "response_1", answers: [] },
    });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      ok: false,
      error: "invalid_form_response",
      detail: "missing_form_id",
    });
    expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("persists the configured budget form before acknowledging it", async () => {
    const payload = {
      event_id: "evt_budget_1",
      event_type: "form_response",
      form_response: {
        form_id: BUDGET_FORM_ID,
        token: "response_budget_1",
        submitted_at: "2026-08-29T14:15:16Z",
        answers: [
          {
            type: "choice",
            field: { ref: "budget_band", id: "CL1VxBC3LVkE" },
            choice: { ref: "25000-50000", label: "$25,000-$50,000" },
          },
        ],
      },
    };
    const body = JSON.stringify(payload);

    const res = await POST(makeRequest(body, sign(body), "evt_from_header"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      intake_id: "intake_budget_1",
      duplicate: false,
      mapping_status: "mapped",
      mapping_warnings: [],
    });
    expect(mockedPersistBudgetIntake).toHaveBeenCalledWith(
      payload,
      payload,
      "evt_from_header",
    );
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("persists incomplete budget mappings and returns review warnings", async () => {
    mockedPersistBudgetIntake.mockResolvedValue({
      id: "intake_review_1",
      duplicate: false,
      mappingStatus: "needs_review",
      mappingWarnings: ["missing_budget_band_ref"],
    });
    const payload = {
      event_type: "form_response",
      form_response: {
        form_id: BUDGET_FORM_ID,
        token: "response_review_1",
        answers: [],
      },
    };
    const body = JSON.stringify(payload);

    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      intake_id: "intake_review_1",
      duplicate: false,
      mapping_status: "needs_review",
      mapping_warnings: ["missing_budget_band_ref"],
    });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("returns the same intake ID and duplicate true for a replay", async () => {
    mockedPersistBudgetIntake.mockResolvedValue({
      id: "intake_original",
      duplicate: true,
      mappingStatus: "mapped",
      mappingWarnings: [],
    });
    const payload = {
      event_type: "form_response",
      form_response: {
        form_id: BUDGET_FORM_ID,
        token: "response_replayed",
        answers: [],
      },
    };
    const body = JSON.stringify(payload);

    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      intake_id: "intake_original",
      duplicate: true,
    });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it.each([
    ["missing response token", { answers: [] }, "missing_response_token"],
    ["missing answers", { token: "response_1" }, "missing_answers"],
  ])(
    "returns 422 when the budget response is structurally invalid: %s",
    async (_label, response, detail) => {
      const body = JSON.stringify({
        event_type: "form_response",
        form_response: { form_id: BUDGET_FORM_ID, ...response },
      });
      const res = await POST(makeRequest(body, sign(body)));
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({
        error: "invalid_form_response",
        detail,
      });
      expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
      expect(mockedProcessLead).not.toHaveBeenCalled();
    },
  );

  it("returns 503 so Typeform retries when durable storage fails", async () => {
    mockedPersistBudgetIntake.mockRejectedValue(
      new Error("database unavailable"),
    );
    const payload = {
      event_type: "form_response",
      form_response: {
        form_id: BUDGET_FORM_ID,
        token: "response_retry_1",
        answers: [],
      },
    };
    const body = JSON.stringify(payload);

    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      ok: false,
      error: "storage_unavailable",
    });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("ignores every form except the configured budget form", async () => {
    const body = JSON.stringify({
      event_type: "form_response",
      form_response: {
        form_id: "legacy-lead-form",
        hidden: {
          email: "lead@example.com",
          name: "Type Form",
          company: "Dobeu",
          utm_source: "google",
          utm_campaign: "spring",
          landing_url: "https://dobeu.net",
        },
        answers: [
          {
            field: { ref: "message" },
            type: "text",
            text: "Need automation support",
          },
        ],
      },
    });

    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      ignored: "unconfigured_form",
    });
    expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("acks non-form events without processing", async () => {
    const body = JSON.stringify({ event_type: "form_response_ended" });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      ignored: "form_response_ended",
    });
    expect(mockedProcessLead).not.toHaveBeenCalled();
    expect(mockedPersistBudgetIntake).not.toHaveBeenCalled();
  });
});
