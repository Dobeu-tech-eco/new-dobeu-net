import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession }
  }))
}));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  exchangeCodeForSession.mockReset();
});

describe("GET /auth/callback", () => {
  it("redirects to safe in-app next path after successful exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await GET(new Request("http://localhost/auth/callback?code=abc&next=%2Fportal%2Ffiles"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/portal/files");
  });

  it("ignores absolute next URLs and falls back to /portal", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await GET(new Request("http://localhost/auth/callback?code=abc&next=https://evil.example"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/portal");
  });

  it("redirects to login error when session exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });

    const res = await GET(new Request("http://localhost/auth/callback?code=bad"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
  });
});
