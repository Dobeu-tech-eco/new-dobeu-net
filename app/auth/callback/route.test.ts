import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession, verifyOtp }
  }))
}));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  verifyOtp.mockReset();
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

  it("does not call verifyOtp when a code is present", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    await GET(new Request("http://localhost/auth/callback?code=abc&token_hash=h&type=invite"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("never verifies an OTP on GET; redirects to the confirm page", async () => {
    const res = await GET(
      new Request("http://localhost/auth/callback?token_hash=abc&type=invite&next=%2Fportal%2Ftickets"),
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "http://localhost/auth/confirm?token_hash=abc&type=invite&next=%2Fportal%2Ftickets",
    );
  });

  it("sanitizes next when handing off to confirm", async () => {
    const res = await GET(
      new Request("http://localhost/auth/callback?token_hash=abc&type=invite&next=/%09/evil.example"),
    );
    expect(res.headers.get("location")).toContain("next=%2Fportal");
  });
});
