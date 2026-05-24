import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

// Mock the lead fan-out so tests stay pure.
vi.mock("@/lib/leads", () => ({
  processLead: vi.fn().mockResolvedValue({ leadId: "lead_1", apolloContactId: "apollo_1" })
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  }))
}));

import { POST } from "@/app/api/webhooks/calendly/route";
import { processLead } from "@/lib/leads";

const mockedProcessLead = vi.mocked(processLead);

const KEY = "test-signing-key";

/** Build a valid Calendly signature header over the EXACT raw body string. */
function sign(rawBody: string, t = Math.floor(Date.now() / 1000), key = KEY): string {
  const v1 = createHmac("sha256", key).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

function makeRequest(rawBody: string, signature?: string | null): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature) headers["Calendly-Webhook-Signature"] = signature;
  return new Request("http://localhost/api/webhooks/calendly", {
    method: "POST",
    body: rawBody,
    headers
  });
}

beforeEach(() => {
  mockedProcessLead.mockClear();
});

afterEach(() => {
  delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
});

describe("POST /api/webhooks/calendly", () => {
  it("returns 503 not_configured when signing key is unset", async () => {
    delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    const body = JSON.stringify({ event: "invitee.created", payload: { email: "a@b.com" } });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("returns 401 on an invalid signature", async () => {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
    const body = JSON.stringify({ event: "invitee.created", payload: { email: "a@b.com" } });
    const res = await POST(makeRequest(body, sign(body, undefined, "wrong-key")));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "invalid_signature" });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("processes a valid invitee.created with email and maps utm/source", async () => {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
    const body = JSON.stringify({
      event: "invitee.created",
      payload: {
        email: "booker@example.com",
        name: "Booker",
        scheduled_event: { uri: "https://cal/uri", name: "Intro Call" },
        tracking: { utm_source: "google", utm_medium: null, utm_campaign: "spring" }
      }
    });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      lead_id: "lead_1",
      apollo_contact_id: "apollo_1"
    });

    expect(mockedProcessLead).toHaveBeenCalledTimes(1);
    expect(mockedProcessLead.mock.calls[0][0]).toMatchObject({
      email: "booker@example.com",
      name: "Booker",
      source: "book",
      message: "Booked: Intro Call",
      utm: { utm_source: "google", utm_campaign: "spring" },
      referrer: "https://cal/uri"
    });
  });

  it("acks (200 ignored) for a valid signature on a non-invitee.created event", async () => {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
    const body = JSON.stringify({ event: "invitee.canceled", payload: { email: "a@b.com" } });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: "invitee.canceled" });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("acks (200 skipped:no_email) for invitee.created without email", async () => {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
    const body = JSON.stringify({ event: "invitee.created", payload: { name: "No Email" } });
    const res = await POST(makeRequest(body, sign(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: "no_email" });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON with a valid signature", async () => {
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
    const raw = "{not json";
    const res = await POST(makeRequest(raw, sign(raw)));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_json" });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });
});
