import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the lead fan-out so tests stay pure (no Supabase/Apollo/etc).
vi.mock("@/lib/leads", () => ({
  processLead: vi.fn().mockResolvedValue({ leadId: "lead_1", apolloContactId: "apollo_1" })
}));

import { POST } from "@/app/api/lead/route";
import { processLead } from "@/lib/leads";

const mockedProcessLead = vi.mocked(processLead);

function makeRequest(body: unknown, ip = "1.1.1.1", rawBody?: string): Request {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    body: rawBody ?? JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-real-ip": ip,
    },
  });
}

beforeEach(() => {
  mockedProcessLead.mockClear();
});

describe("POST /api/lead", () => {
  it("accepts a valid body and returns lead + apollo ids", async () => {
    const res = await POST(makeRequest({ email: "a@b.com", source: "form" }, "10.0.0.1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      lead_id: "lead_1",
      apollo_contact_id: "apollo_1"
    });

    expect(mockedProcessLead).toHaveBeenCalledTimes(1);
    const arg = mockedProcessLead.mock.calls[0][0];
    expect(arg).toMatchObject({ email: "a@b.com", source: "form" });
    // ipHash derived from x-real-ip/x-forwarded-for (light non-crypto hash, ip_ prefix).
    expect(arg.ipHash).toMatch(/^ip_/);
  });

  it("prioritizes x-real-ip over x-forwarded-for and takes rightmost IP for x-forwarded-for", async () => {
    const res = await POST(new Request("http://localhost/api/lead", {
      method: "POST",
      body: JSON.stringify({ email: "x@y.com" }),
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" }
    }));
    expect(res.status).toBe(200);
    // ip_ prefix + 16 chars hex of rightmost IP 2.2.2.2
    const { createHash } = await import("node:crypto");
    const hash2222 = createHash("sha256").update("2.2.2.2").digest("hex").slice(0, 16);
    expect(mockedProcessLead.mock.calls[0][0].ipHash).toBe("ip_" + hash2222);
  });

  it("defaults source to 'other' when omitted", async () => {
    const res = await POST(makeRequest({ email: "c@d.com" }, "10.0.0.2"));
    expect(res.status).toBe(200);
    expect(mockedProcessLead.mock.calls[0][0]).toMatchObject({ source: "other" });
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makeRequest(undefined, "10.0.0.3", "{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("returns 400 with details on Zod validation failure (bad email)", async () => {
    const res = await POST(makeRequest({ email: "not-an-email" }, "10.0.0.4"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details.fieldErrors.email).toBeDefined();
    expect(mockedProcessLead).not.toHaveBeenCalled();
  });

  it("returns 400 with details when email is missing", async () => {
    const res = await POST(makeRequest({ source: "form" }, "10.0.0.5"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid input");
    expect(json.details.fieldErrors.email).toBeDefined();
  });

  it("rate-limits the 6th request from the same IP within the window (429)", async () => {
    const ip = "203.0.113.99"; // distinct IP to avoid module-level bucket bleed
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ email: "e@f.com" }, ip));
      expect(res.status).toBe(200);
    }
    const sixth = await POST(makeRequest({ email: "e@f.com" }, ip));
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({ error: "Too many requests" });
    // 5 succeeded, 6th short-circuited before processLead.
    expect(mockedProcessLead).toHaveBeenCalledTimes(5);
  });
});
