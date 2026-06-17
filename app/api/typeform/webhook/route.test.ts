import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("@/lib/leads", () => ({
  processLead: vi.fn().mockResolvedValue({ leadId: "lead_tf_1", apolloContactId: "apollo_tf_1" })
}));

import { POST } from "@/app/api/typeform/webhook/route";
import { processLead } from "@/lib/leads";

const mockedProcessLead = vi.mocked(processLead);
const SECRET = "typeform-secret";

function sign(rawBody: string, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("base64")}`;
}

function makeRequest(rawBody: string, signature?: string | null): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature) headers["typeform-signature"] = signature;
  return new Request("http://localhost/api/typeform/webhook", { method: "POST", body: rawBody, headers });
}

beforeEach(() => {
  mockedProcessLead.mockClear();
  process.env.TYPEFORM_WEBHOOK_SECRET = SECRET;
});

describe("POST /api/typeform/webhook", () => {
  it("returns 503 when webhook secret is missing", async () => {
    delete process.env.TYPEFORM_WEBHOOK_SECRET;
    const body = JSON.stringify({ event_type: "form_response", form_response: {} });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
  });

  it("returns 401 on invalid signature", async () => {
    const body = JSON.stringify({ event_type: "form_response", form_response: {} });
    const res = await POST(makeRequest(body, sign(body, "wrong")));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_signature" });
  });

  it("maps form_response into processLead payload", async () => {
    const body = JSON.stringify({
      event_type: "form_response",
      form_response: {
        hidden: {
          email: "lead@example.com",
          name: "Type Form",
          company: "Dobeu",
          utm_source: "google",
          utm_campaign: "spring",
          landing_url: "https://dobeu.net"
        },
        answers: [{ field: { ref: "message" }, type: "text", text: "Need automation support" }]
      }
    });

    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, lead_id: "lead_tf_1", apollo_contact_id: "apollo_tf_1" });
    expect(mockedProcessLead).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "lead@example.com",
        name: "Type Form",
        company: "Dobeu",
        source: "typeform",
        message: "Need automation support",
        utm: { utm_source: "google", utm_campaign: "spring" },
        referrer: "https://dobeu.net"
      })
    );
  });

  it("acks non-form events without processing", async () => {
    const body = JSON.stringify({ event_type: "form_response_ended" });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: "form_response_ended" });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });
});
