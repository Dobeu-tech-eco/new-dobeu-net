import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { verifyOtp } })),
}));

import { POST } from "@/app/auth/confirm/submit/route";
import { OTP_COOKIE_PATH } from "@/app/auth/confirm/cookie";

function pending(token_hash = "abc", type = "invite") {
  return `sb-otp-pending=${encodeURIComponent(JSON.stringify({ token_hash, type }))}`;
}

function post(opts: { cookie?: string; origin?: string | null; fetchSite?: string; next?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (opts.cookie) headers.cookie = opts.cookie;
  const origin = opts.origin === undefined ? "http://localhost" : opts.origin;
  if (origin !== null) headers.origin = origin;
  if (opts.fetchSite) headers["sec-fetch-site"] = opts.fetchSite;
  return POST(
    new Request("http://localhost/auth/confirm/submit", {
      method: "POST",
      headers,
      body: new URLSearchParams({ next: opts.next ?? "/portal/files" }),
    }),
  );
}

beforeEach(() => verifyOtp.mockReset());

describe("cookie scope", () => {
  it("cookie path covers the submit route (browsers send it to a sub-path)", () => {
    expect(OTP_COOKIE_PATH).toBe("/auth/confirm");
    expect("/auth/confirm/submit".startsWith(OTP_COOKIE_PATH + "/")).toBe(true);
  });
});

describe("POST /auth/confirm/submit", () => {
  it.each(["invite", "magiclink", "email", "signup"])("verifies cookie type %s and clears the cookie", async (type) => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await post({ cookie: pending("abc", type) });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/portal/files");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb-otp-pending=;");
    expect(setCookie).toMatch(/Max-Age=0/i);
  });

  it("returns 403 for a foreign Origin and never verifies", async () => {
    const res = await post({ cookie: pending(), origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("rejects a literal Origin: null (sandboxed iframe / no-referrer page) and never verifies", async () => {
    const res = await post({ cookie: pending(), origin: "null", fetchSite: "same-origin" });
    expect(res.status).toBe(403);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("without Origin allows only same-origin or none Sec-Fetch-Site", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    expect((await post({ cookie: pending(), origin: null, fetchSite: "cross-site" })).status).toBe(403);
    expect((await post({ cookie: pending(), origin: null })).status).toBe(403);
    expect(verifyOtp).not.toHaveBeenCalled();
    expect((await post({ cookie: pending(), origin: null, fetchSite: "same-origin" })).status).toBe(303);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it("fails without the cookie, with a bad cookie, or with recovery type", async () => {
    const cookies = [undefined, "sb-otp-pending=garbage", pending("abc", "recovery"), pending("", "invite")];
    for (const cookie of cookies) {
      const res = await post({ cookie });
      expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("ignores token fields in the form body", async () => {
    const res = await POST(
      new Request("http://localhost/auth/confirm/submit", {
        method: "POST",
        headers: { origin: "http://localhost", "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token_hash: "abc", type: "invite" }),
      }),
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("rejects open-redirect next", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    for (const next of ["//evil.example", "/%09/evil.example", "https://evil.example"]) {
      const res = await post({ cookie: pending(), next });
      expect(res.headers.get("location")).toBe("http://localhost/portal");
    }
  });

  it("redirects to login error and clears cookie when verifyOtp fails", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const res = await post({ cookie: pending() });
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
    expect(res.headers.get("set-cookie") ?? "").toMatch(/Max-Age=0/i);
  });
});
