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

  it.each(["invite", "magiclink", "email", "recovery", "signup"])(
    "verifies token_hash with type %s",
    async (type) => {
      verifyOtp.mockResolvedValue({ error: null });
      const res = await GET(
        new Request(`http://localhost/auth/callback?token_hash=abc123&type=${type}&next=%2Fportal%2Ftickets`),
      );
      expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type });
      expect(res.headers.get("location")).toBe("http://localhost/portal/tickets");
    },
  );

  it("rejects an unknown type without calling verifyOtp", async () => {
    const res = await GET(new Request("http://localhost/auth/callback?token_hash=abc&type=admin"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
  });

  it("rejects empty or oversized token_hash", async () => {
    const empty = await GET(new Request("http://localhost/auth/callback?token_hash=&type=invite"));
    const big = await GET(
      new Request(`http://localhost/auth/callback?token_hash=${"a".repeat(600)}&type=invite`),
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(empty.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
    expect(big.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
  });

  it("rejects open-redirect next on the verifyOtp path", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await GET(
      new Request("http://localhost/auth/callback?token_hash=abc&type=invite&next=//evil.example"),
    );
    expect(res.headers.get("location")).toBe("http://localhost/portal");
  });

  it("redirects to login error when verifyOtp fails", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const res = await GET(new Request("http://localhost/auth/callback?token_hash=abc&type=invite"));
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
  });
});
