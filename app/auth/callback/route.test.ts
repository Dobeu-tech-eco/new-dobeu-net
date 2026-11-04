import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();
const getUser = vi.fn();
const getAal = vi.fn();
const updateUserById = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession, verifyOtp, getUser, mfa: { getAuthenticatorAssuranceLevel: getAal } }
  })),
  createAdminClient: vi.fn(() => ({ auth: { admin: { updateUserById } } }))
}));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  verifyOtp.mockReset();
  getUser.mockReset();
  getAal.mockReset();
  updateUserById.mockReset();
  getUser.mockResolvedValue({
    data: {
      user: {
        id: "u1",
        email: "me@example.com",
        recovery_sent_at: "2026-11-01T10:00:00.000Z",
        email_change_sent_at: null,
        identities: [{ provider: "email", updated_at: "2026-10-01T00:00:00.000Z" }],
      },
    },
  });
  getAal.mockResolvedValue({
    data: { currentAuthenticationMethods: [{ method: "otp", timestamp: 1793527205 }] },
    error: null,
  });
  updateUserById.mockResolvedValue({ error: null });
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

  it("never verifies on GET; parks the token in a Lax httpOnly cookie (Strict is withheld on email-initiated chains), not the URL", async () => {
    const res = await GET(
      new Request("http://localhost/auth/callback?token_hash=abc&type=invite&next=%2Fportal%2Ftickets"),
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/auth/confirm?next=%2Fportal%2Ftickets");
    expect(res.headers.get("location")).not.toContain("abc");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("sb-otp-pending=");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toContain("Path=/auth/confirm");
    expect(cookie).toMatch(/Max-Age=120/);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it("sets Secure off localhost", async () => {
    const res = await GET(new Request("https://dobeu.net/auth/callback?token_hash=abc&type=invite"));
    expect(res.headers.get("set-cookie") ?? "").toMatch(/Secure/i);
  });

  it("rejects invalid type or token without setting a cookie", async () => {
    const bad = [
      "token_hash=abc&type=recovery",
      "token_hash=&type=invite",
      `token_hash=${"a".repeat(600)}&type=invite`,
    ];
    for (const q of bad) {
      const res = await GET(new Request(`http://localhost/auth/callback?${q}`));
      expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("sanitizes next when handing off to confirm", async () => {
    const res = await GET(
      new Request("http://localhost/auth/callback?token_hash=abc&type=invite&next=/%09/evil.example"),
    );
    expect(res.headers.get("location")).toBe("http://localhost/auth/confirm?next=%2Fportal");
  });

  it("records the email-link sign-in after a successful exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    await GET(new Request("http://localhost/auth/callback?code=abc"));
    expect(updateUserById).toHaveBeenCalledWith("u1", {
      app_metadata: { email_link_signin: { at: "2026-11-01T10:00:05.000Z", email: "me@example.com" } }
    });
  });

  it("does not record when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
    await GET(new Request("http://localhost/auth/callback?code=bad"));
    expect(getUser).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("still redirects when the marker write fails or throws", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    updateUserById.mockResolvedValue({ error: new Error("db down") });
    let res = await GET(new Request("http://localhost/auth/callback?code=abc&next=%2Fportal%2Ffiles"));
    expect(res.headers.get("location")).toBe("http://localhost/portal/files");
    getUser.mockRejectedValue(new Error("auth down"));
    res = await GET(new Request("http://localhost/auth/callback?code=abc&next=%2Fportal%2Ffiles"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/portal/files");
  });
});
