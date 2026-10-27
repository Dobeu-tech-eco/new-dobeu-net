import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/leads", () => ({ processLead: vi.fn(), findLeadByVerifyNonce: vi.fn() }));

import * as routeModule from "@/app/api/lead/confirm/route";
import { POST } from "@/app/api/lead/confirm/route";
import { findLeadByVerifyNonce, processLead } from "@/lib/leads";
import { signLeadToken, LEAD_TOKEN_TTL_MS } from "@/lib/lead-verification";

const mockedProcess = vi.mocked(processLead);
const mockedFind = vi.mocked(findLeadByVerifyNonce);

const input = {
  email: "a@b.com",
  name: "A",
  company: null,
  message: "hello",
  source: "form" as const,
  utm: {},
  referrer: null,
  ipHash: "ip_x"
};

const SECRET = "t".repeat(40);
let n = 0;
function req(body: unknown, raw?: string) {
  return new Request("http://localhost/api/lead/confirm", {
    method: "POST",
    body: raw ?? JSON.stringify(body),
    headers: { "x-real-ip": `172.16.0.${++n}` }
  });
}

beforeEach(() => {
  mockedProcess.mockReset().mockResolvedValue({ leadId: "lead_1" });
  mockedFind.mockReset().mockResolvedValue(null);
  process.env.LEAD_VERIFY_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.LEAD_VERIFY_SECRET;
});

describe("POST /api/lead/confirm", () => {
  it("valid token calls processLead once with the nonce", async () => {
    const token = signLeadToken(input, SECRET, Date.now());
    const res = await POST(req({ token }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, source: "form", has_message: true });
    expect(mockedProcess).toHaveBeenCalledTimes(1);
    expect(mockedProcess.mock.calls[0][0]).toMatchObject({
      email: "a@b.com",
      verifyNonce: expect.stringMatching(/^[0-9a-f]{32}$/)
    });
  });

  it("replay of an already-confirmed token is ok without a second processLead", async () => {
    mockedFind.mockResolvedValueOnce("lead_1");
    const token = signLeadToken(input, SECRET, Date.now());
    const res = await POST(req({ token }));
    expect(res.status).toBe(200);
    expect(mockedProcess).not.toHaveBeenCalled();
  });

  it("rejects tampered and expired tokens with 400", async () => {
    const token = signLeadToken(input, SECRET, Date.now());
    const raw = Buffer.from(token, "base64url");
    raw[20] ^= 1;
    const tampered = await POST(req({ token: raw.toString("base64url") }));
    expect(tampered.status).toBe(400);
    expect(await tampered.json()).toEqual({ ok: false, error: "invalid" });

    const old = signLeadToken(input, SECRET, Date.now() - LEAD_TOKEN_TTL_MS - 5000);
    const expired = await POST(req({ token: old }));
    expect(expired.status).toBe(400);
    expect(await expired.json()).toEqual({ ok: false, error: "expired" });
    expect(mockedProcess).not.toHaveBeenCalled();
  });

  it("400 on malformed body", async () => {
    expect((await POST(req(null, "{nope"))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
  });

  it("503 on persistence failure and when the secret is unset", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = signLeadToken(input, SECRET, Date.now());
    mockedProcess.mockRejectedValueOnce(new Error("db"));
    expect((await POST(req({ token }))).status).toBe(503);
    delete process.env.LEAD_VERIFY_SECRET;
    expect((await POST(req({ token }))).status).toBe(503);
    err.mockRestore();
  });

  it("second concurrent confirm gets 409 and processLead runs once", async () => {
    let release!: () => void;
    mockedProcess.mockReset().mockImplementation(
      () => new Promise((r) => { release = () => r({ leadId: "lead_1" }); })
    );
    const token = signLeadToken(input, SECRET, Date.now());
    const first = POST(req({ token }));
    await new Promise((r) => setTimeout(r, 10));
    const second = await POST(req({ token }));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ ok: false, error: "in_progress" });
    release();
    expect((await first).status).toBe(200);
    expect(mockedProcess).toHaveBeenCalledTimes(1);
  });

  it("retry after persistence failure is not stuck on the nonce lock", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = signLeadToken(input, SECRET, Date.now());
    mockedProcess.mockRejectedValueOnce(new Error("db"));
    expect((await POST(req({ token }))).status).toBe(503);
    mockedProcess.mockResolvedValueOnce({ leadId: "lead_1" });
    const retry = await POST(req({ token }));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ ok: true, source: "form", has_message: true });
    expect(mockedProcess).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });

  it("repeat confirm after completion returns 200 even inside the lock window", async () => {
    const token = signLeadToken(input, SECRET, Date.now());
    expect((await POST(req({ token }))).status).toBe(200);
    mockedFind.mockResolvedValueOnce("lead_1");
    const again = await POST(req({ token }));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, source: "form", has_message: true });
    expect(mockedProcess).toHaveBeenCalledTimes(1);
  });

  it("503 when the secret is under 32 chars", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.LEAD_VERIFY_SECRET = "short";
    const token = signLeadToken(input, SECRET, Date.now());
    expect((await POST(req({ token }))).status).toBe(503);
    err.mockRestore();
  });

  it("exports no GET handler", () => {
    expect("GET" in routeModule).toBe(false);
  });
});
