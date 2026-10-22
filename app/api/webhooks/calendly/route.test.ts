import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

// Mock the lead fan-out so tests stay pure.
vi.mock("@/lib/leads", () => ({
  processLead: vi.fn().mockResolvedValue({ leadId: "lead_1", apolloContactId: "apollo_1" })
}));
vi.mock("@/lib/datadog-server", () => ({
  logToDatadog: vi.fn(),
  logServerError: vi.fn()
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
import { createAdminClient } from "@/lib/supabase/server";
import { logServerError, logToDatadog } from "@/lib/datadog-server";

const mockedProcessLead = vi.mocked(processLead);
const mockedLog = vi.mocked(logToDatadog);
const mockedLogError = vi.mocked(logServerError);

/** Everything sent to Datadog, serialized, for leak assertions. */
function datadogDump(): string {
  return JSON.stringify([mockedLog.mock.calls, mockedLogError.mock.calls]);
}

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
  mockedLog.mockReset();
  mockedLogError.mockReset();
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

  describe("Datadog failure logging", () => {
    const bookingBody = JSON.stringify({
      event: "invitee.created",
      payload: {
        email: "booker@example.com",
        name: "Booker",
        scheduled_event: {
          uri: "https://cal/uri",
          name: "Intro Call",
          start_time: "2026-11-01T15:00:00Z"
        }
      }
    });

    it("logs a warn on a bad signature without payload, headers or the key", async () => {
      process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
      const badSig = sign(bookingBody, undefined, "wrong-key");
      const res = await POST(makeRequest(bookingBody, badSig));
      expect(res.status).toBe(401);
      expect(mockedLog).toHaveBeenCalledTimes(1);
      expect(mockedLog).toHaveBeenCalledWith(
        "warn",
        "calendly_webhook_invalid_signature",
        expect.objectContaining({ route: "/api/webhooks/calendly" })
      );
      const dump = datadogDump();
      expect(dump).not.toContain(KEY);
      expect(dump).not.toContain(badSig);
      expect(dump).not.toContain("booker@example.com");
      expect(dump).not.toContain(JSON.stringify(bookingBody));
    });

    it("logs and rethrows when lead processing fails (status unchanged)", async () => {
      process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
      mockedProcessLead.mockRejectedValueOnce(new Error("fan-out exploded"));
      await expect(POST(makeRequest(bookingBody, sign(bookingBody)))).rejects.toThrow(
        "fan-out exploded"
      );
      expect(mockedLogError).toHaveBeenCalledTimes(1);
      expect(mockedLogError.mock.calls[0][1]).toMatchObject({
        msg: "calendly_webhook_processing_failed",
        event_type: "invitee.created"
      });
      const dump = datadogDump();
      expect(dump).not.toContain(KEY);
      expect(dump).not.toContain("booker@example.com");
    });

    it("logs a booking insert failure but still returns 200", async () => {
      process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
      vi.mocked(createAdminClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "23503", message: "insert or update on table violates foreign key constraint" }
          })
        }))
      } as unknown as ReturnType<typeof createAdminClient>);
      const res = await POST(makeRequest(bookingBody, sign(bookingBody)));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, lead_id: "lead_1" });
      expect(mockedLog).toHaveBeenCalledWith(
        "error",
        "calendly_booking_insert_failed",
        expect.objectContaining({ lead_id: "lead_1", error: expect.objectContaining({ code: "23503" }) })
      );
      expect(datadogDump()).not.toContain("booker@example.com");
    });

    it("stays non-fatal when the logger itself throws", async () => {
      process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
      mockedLog.mockRejectedValueOnce(new Error("datadog down"));
      const res = await POST(makeRequest(bookingBody, sign(bookingBody, undefined, "wrong-key")));
      expect(res.status).toBe(401);
    });

    it("does not log on a successful booking", async () => {
      process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;
      const res = await POST(makeRequest(bookingBody, sign(bookingBody)));
      expect(res.status).toBe(200);
      expect(mockedLog).not.toHaveBeenCalled();
      expect(mockedLogError).not.toHaveBeenCalled();
    });
  });
});
