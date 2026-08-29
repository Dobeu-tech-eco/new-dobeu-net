import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser }
  })),
  createAdminClient: vi.fn(() => ({}))
}));

const checkRateLimit = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args)
}));

const createIntercomUserJwt = vi.fn();

vi.mock("@/lib/intercom-jwt", () => ({
  createIntercomUserJwt: (...args: unknown[]) => createIntercomUserJwt(...args)
}));

vi.mock("@/lib/intercom", () => ({
  intercomNameFromUser: vi.fn(() => "Test User")
}));

const cookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet }))
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/intercom/jwt/route";

const LEGACY_VISITOR_COOKIE = "dobeu_intercom_visitor";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/intercom/jwt", { headers });
}

beforeEach(() => {
  getUser.mockReset();
  checkRateLimit.mockReset();
  createIntercomUserJwt.mockReset();
  cookieGet.mockReset();
  vi.stubEnv("INTERCOM_API_SECRET", "test-secret");
  // Defaults: not rate limited, anonymous visitor, no legacy cookie.
  checkRateLimit.mockResolvedValue({ limited: false });
  getUser.mockResolvedValue({ data: { user: null } });
  cookieGet.mockReturnValue(undefined);
  createIntercomUserJwt.mockReturnValue("signed.jwt.token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/intercom/jwt", () => {
  it("returns 503 when INTERCOM_API_SECRET is not configured", async () => {
    vi.stubEnv("INTERCOM_API_SECRET", "");

    const res = await GET(makeRequest());

    expect(res.status).toBe(503);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(createIntercomUserJwt).not.toHaveBeenCalled();
  });

  it("returns 429 when the caller is rate limited", async () => {
    checkRateLimit.mockResolvedValue({ limited: true });

    const res = await GET(makeRequest());

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests" });
    expect(createIntercomUserJwt).not.toHaveBeenCalled();
  });

  it("keys the rate limit on x-real-ip when present", async () => {
    await GET(makeRequest({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 8.8.8.8" }));

    expect(checkRateLimit).toHaveBeenCalledWith(
      "intercom-jwt:1.2.3.4",
      expect.objectContaining({ windowSec: 60, max: 20 })
    );
  });

  it("falls back to the first x-forwarded-for hop, then 'unknown'", async () => {
    await GET(makeRequest({ "x-forwarded-for": "9.9.9.9, 8.8.8.8" }));
    expect(checkRateLimit).toHaveBeenLastCalledWith("intercom-jwt:9.9.9.9", expect.anything());

    await GET(makeRequest());
    expect(checkRateLimit).toHaveBeenLastCalledWith("intercom-jwt:unknown", expect.anything());
  });

  it("signs a user JWT for an authenticated user and sets no visitor cookie", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "jeremy@example.com",
          created_at: "2026-01-01T00:00:00.000Z"
        }
      }
    });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "signed.jwt.token" });
    expect(createIntercomUserJwt).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        email: "jeremy@example.com",
        name: "Test User",
        created_at: Math.floor(new Date("2026-01-01T00:00:00.000Z").getTime() / 1000)
      })
    );
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 204 with no body for anonymous callers and never signs a visitor JWT", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(createIntercomUserJwt).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("clears a legacy visitor cookie when an anonymous caller still carries one", async () => {
    cookieGet.mockReturnValue({ value: "legacy-visitor-id" });

    const res = await GET(makeRequest());

    expect(res.status).toBe(204);
    expect(createIntercomUserJwt).not.toHaveBeenCalled();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${LEGACY_VISITOR_COOKIE}=;`);
    expect(setCookie.toLowerCase()).toContain("max-age=0");
  });

  it("returns 500 when JWT signing produces no token for an authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-123", email: "jeremy@example.com" } } });
    createIntercomUserJwt.mockReturnValue(undefined);

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to sign Intercom JWT" });
  });
});
