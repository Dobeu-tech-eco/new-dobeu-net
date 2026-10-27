import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/leads", () => ({ processLead: vi.fn() }));
vi.mock("@/lib/resend", () => ({ sendEmail: vi.fn() }));

import { POST } from "@/app/api/lead/route";
import { processLead } from "@/lib/leads";
import { sendEmail } from "@/lib/resend";
import { verifyLeadToken } from "@/lib/lead-verification";

const mockedSend = vi.mocked(sendEmail);
const mockedProcess = vi.mocked(processLead);

function makeRequest(
  body: unknown,
  ip = "1.1.1.1",
  opts: { rawBody?: string; origin?: string | null } = {}
): Request {
  const headers: Record<string, string> = { "content-type": "application/json", "x-real-ip": ip };
  if (opts.origin !== null) headers.origin = opts.origin ?? "https://dobeu.net";
  return new Request("http://localhost/api/lead", {
    method: "POST",
    body: opts.rawBody ?? JSON.stringify(body),
    headers
  });
}

const SECRET = "t".repeat(40);
let counter = 0;
const uniqueIp = () => `10.9.${Math.floor(counter / 250)}.${(counter++ % 250) + 1}`;
const goodBody = (email: string) => ({
  email,
  source: "form",
  name: "Zed",
  message: "Dispatch still lives in the inbox.",
  elapsed_ms: 10_000
});

beforeEach(() => {
  mockedSend.mockReset().mockResolvedValue({ ok: true, id: "e1" });
  mockedProcess.mockReset();
  process.env.LEAD_VERIFY_SECRET = SECRET;
  process.env.NEXT_PUBLIC_SITE_URL = "https://dobeu.net";
});
afterEach(() => {
  delete process.env.LEAD_VERIFY_SECRET;
});

describe("POST /api/lead", () => {
  it("sends one verify email with a valid confirm link and never calls processLead", async () => {
    const res = await POST(makeRequest(goodBody("ok1@b.com"), uniqueIp()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, pending: true });
    expect(mockedProcess).not.toHaveBeenCalled();
    expect(mockedSend).toHaveBeenCalledTimes(1);
    const args = mockedSend.mock.calls[0][0];
    expect(args.to).toBe("ok1@b.com");
    expect(args.text).not.toContain("Hey Zed");
    const url = args.text!.match(/https:\/\/dobeu\.net\/lead\/confirm\?token=(\S+)/);
    expect(url).not.toBeNull();
    const v = verifyLeadToken(decodeURIComponent(url![1]), SECRET, Date.now());
    expect(v.ok && v.payload.ipHash).toMatch(/^ip_/);
  });

  it.each([
    ["honeypot", { hp_ref: "http://spam.test" }],
    ["too fast", { elapsed_ms: 200 }],
    ["missing elapsed_ms", { elapsed_ms: undefined }],
    ["gibberish", { message: "IwRRUNZxkePMWRwvjkC" }]
  ])("silently drops spam (%s): 200 pending, no email", async (_n, extra) => {
    const res = await POST(makeRequest({ ...goodBody("sp@b.com"), ...extra }, uniqueIp()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, pending: true });
    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedProcess).not.toHaveBeenCalled();
  });

  it("drops requests with missing or foreign Origin", async () => {
    for (const origin of [null, "https://evil.example"]) {
      const res = await POST(makeRequest(goodBody("o@b.com"), uniqueIp(), { origin }));
      expect(await res.json()).toEqual({ ok: true, pending: true });
    }
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("returns 503 when LEAD_VERIFY_SECRET is unset", async () => {
    delete process.env.LEAD_VERIFY_SECRET;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest(goodBody("ns@b.com"), uniqueIp()));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false });
    expect(mockedSend).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("treats a short secret as unconfigured (503)", async () => {
    process.env.LEAD_VERIFY_SECRET = "short";
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(makeRequest(goodBody("sh@b.com"), uniqueIp()))).status).toBe(503);
    err.mockRestore();
  });

  it("checks the secret before consuming the per-email limit", async () => {
    delete process.env.LEAD_VERIFY_SECRET;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) {
      expect((await POST(makeRequest(goodBody("pre@b.com"), uniqueIp()))).status).toBe(503);
    }
    err.mockRestore();
  });

  it("returns 503 when the verify email fails to send", async () => {
    mockedSend.mockResolvedValueOnce({ ok: false, error: "boom" });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(makeRequest(goodBody("sf@b.com"), uniqueIp()));
    expect(res.status).toBe(503);
    err.mockRestore();
  });

  it("limits a single email to 3 per hour (429)", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await POST(makeRequest(goodBody("Rep@b.com"), uniqueIp()))).status).toBe(200);
    }
    const res = await POST(makeRequest(goodBody("rep@B.com"), uniqueIp()));
    expect(res.status).toBe(429);
    expect(mockedSend).toHaveBeenCalledTimes(3);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makeRequest(undefined, uniqueIp(), { rawBody: "{not json" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 on bad email, missing email, or empty form message", async () => {
    for (const [body, field] of [
      [{ email: "not-an-email" }, "email"],
      [{ source: "form" }, "email"],
      [{ email: "a@b.com", source: "form", message: "   " }, "message"]
    ] as const) {
      const res = await POST(makeRequest(body, uniqueIp()));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid input");
      expect(json.details.fieldErrors[field]).toBeDefined();
    }
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("rate-limits the 6th request from the same IP within the window (429)", async () => {
    const ip = "203.0.113.99";
    for (let i = 0; i < 5; i++) {
      expect((await POST(makeRequest(goodBody(`ip${i}@b.com`), ip))).status).toBe(200);
    }
    const sixth = await POST(makeRequest(goodBody("ip9@b.com"), ip));
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({ error: "Too many requests" });
  });
});
