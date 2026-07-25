import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  // The route gate calls createClient().auth.getUser() before anything else.
  createClient: vi.fn(async () => ({
    auth: { getUser }
  })),
  createAdminClient: vi.fn(() => ({}))
}));

const runAgent = vi.fn();

vi.mock("@/lib/agent", () => ({
  runAgent: (...args: unknown[]) => runAgent(...args)
}));

import { POST } from "@/app/api/agent/route";

const ADMIN_EMAIL = "admin@example.com";

function makeRequest(body: unknown, raw = false): Request {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body)
  });
}

beforeEach(() => {
  getUser.mockReset();
  runAgent.mockReset();
  vi.stubEnv("ADMIN_EMAILS", ADMIN_EMAIL);
  // Default: an authenticated admin so most cases exercise the happy path.
  getUser.mockResolvedValue({ data: { user: { id: "u1", email: ADMIN_EMAIL } } });
  runAgent.mockResolvedValue({ ok: true, result: "done", trace: [] });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/agent", () => {
  it("returns 403 when the caller is not authenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest({ prompt: "hi" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller is authenticated but not an admin", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u2", email: "client@example.com" } } });

    const res = await POST(makeRequest({ prompt: "hi" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not valid JSON", async () => {
    const res = await POST(makeRequest("{not json", true));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
    expect(runAgent).not.toHaveBeenCalled();
  });

  describe("input validation (400 invalid_input)", () => {
    const cases: Array<[string, unknown]> = [
      ["missing prompt", {}],
      ["empty prompt", { prompt: "" }],
      ["prompt over 8000 chars", { prompt: "x".repeat(8001) }],
      ["non-string prompt", { prompt: 42 }],
      ["systemPrompt over 8000 chars", { prompt: "hi", systemPrompt: "y".repeat(8001) }]
    ];

    for (const [label, body] of cases) {
      it(`rejects ${label}`, async () => {
        const res = await POST(makeRequest(body));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe("invalid_input");
        expect(json.details).toBeDefined();
        expect(runAgent).not.toHaveBeenCalled();
      });
    }
  });

  it("returns 200 with result and trace on success", async () => {
    runAgent.mockResolvedValue({ ok: true, result: "triaged the lead", trace: [{ step: 1 }] });

    const res = await POST(makeRequest({ prompt: "triage the newest lead" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      result: "triaged the lead",
      trace: [{ step: 1 }]
    });
    expect(runAgent).toHaveBeenCalledWith({
      userId: "u1",
      prompt: "triage the newest lead"
    });
  });

  it("forwards systemPrompt only when provided", async () => {
    await POST(makeRequest({ prompt: "hi", systemPrompt: "be terse" }));

    expect(runAgent).toHaveBeenCalledWith({
      userId: "u1",
      prompt: "hi",
      systemPrompt: "be terse"
    });
    // And the key is entirely absent when not provided (spread guard).
    runAgent.mockClear();
    await POST(makeRequest({ prompt: "hi" }));
    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(runAgent.mock.calls[0]![0]).not.toHaveProperty("systemPrompt");
  });

  describe("agent failures", () => {
    it("returns 503 when the agent is not configured", async () => {
      runAgent.mockResolvedValue({ ok: false, error: "not_configured" });

      const res = await POST(makeRequest({ prompt: "hi" }));

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ ok: false, error: "not_configured" });
    });

    it("returns 503 when the SDK is not installed", async () => {
      runAgent.mockResolvedValue({ ok: false, error: "sdk_not_installed" });

      const res = await POST(makeRequest({ prompt: "hi" }));

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ ok: false, error: "sdk_not_installed" });
    });

    it("returns 500 for any other agent error", async () => {
      runAgent.mockResolvedValue({ ok: false, error: "agent_crashed" });

      const res = await POST(makeRequest({ prompt: "hi" }));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ ok: false, error: "agent_crashed" });
    });
  });
});
