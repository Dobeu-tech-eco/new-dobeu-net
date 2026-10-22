import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { verifyOtp } })),
}));

import { POST } from "@/app/auth/confirm/route";

function post(fields: Record<string, string>) {
  const body = new URLSearchParams(fields);
  return POST(
    new Request("http://localhost/auth/confirm", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }),
  );
}

beforeEach(() => verifyOtp.mockReset());

describe("POST /auth/confirm", () => {
  it.each(["invite", "magiclink", "email", "signup"])("verifies type %s", async (type) => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await post({ token_hash: "abc", type, next: "/portal/files" });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/portal/files");
  });

  it.each(["recovery", "admin", ""])("rejects type %s", async (type) => {
    const res = await post({ token_hash: "abc", type });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
  });

  it("rejects empty and oversized token_hash", async () => {
    await post({ token_hash: "", type: "invite" });
    await post({ token_hash: "a".repeat(600), type: "invite" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("rejects open-redirect next", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    for (const next of ["//evil.example", "/%09/evil.example", "https://evil.example"]) {
      const res = await post({ token_hash: "abc", type: "invite", next });
      expect(res.headers.get("location")).toBe("http://localhost/portal");
    }
  });

  it("redirects to login error when verifyOtp fails", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const res = await post({ token_hash: "abc", type: "invite" });
    expect(res.headers.get("location")).toBe("http://localhost/login?error=auth_callback_failed");
  });
});
