import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAal: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: h.getUser,
      mfa: { getAuthenticatorAssuranceLevel: h.getAal },
    },
  })),
}));

import { updateSession } from "@/lib/supabase/middleware";

/**
 * These tests exercise the defensive auth-code forwarder, which runs before any
 * Supabase client is constructed. With the Supabase env vars unset, the rest of
 * updateSession falls through to NextResponse.next() for public paths, so we can
 * isolate the forwarder behavior. @supabase/ssr is mocked (above) for the gating
 * tests further down; the forwarder tests never reach the client.
 */
const ORIGINAL_URL = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL;
const ORIGINAL_ANON = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY;

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY;
});

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_ANON === undefined) delete process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY = ORIGINAL_ANON;
});

describe("updateSession — stray ?code= forwarder", () => {
  it("forwards a stray code on the root path to /auth/callback (Site-URL fallback rescue)", async () => {
    const res = await updateSession(
      new NextRequest("https://dobeu.net/?code=pkce-abc-123"),
    );
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") as string);
    expect(location.pathname).toBe("/auth/callback");
    expect(location.searchParams.get("code")).toBe("pkce-abc-123");
  });

  it("forwards a stray code on an arbitrary non-callback path", async () => {
    const res = await updateSession(
      new NextRequest("https://dobeu.net/pricing?code=xyz&next=%2Fportal"),
    );
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") as string);
    expect(location.pathname).toBe("/auth/callback");
    expect(location.searchParams.get("code")).toBe("xyz");
    expect(location.searchParams.get("next")).toBe("/portal");
  });

  it("does NOT forward when the code is already on /auth/callback (no redirect loop)", async () => {
    const res = await updateSession(
      new NextRequest("https://dobeu.net/auth/callback?code=abc"),
    );
    // Falls through to NextResponse.next() (env unset, public path) — never a
    // redirect back to /auth/callback.
    const location = res.headers.get("location");
    expect(location).toBeNull();
  });

  it("does not interfere with normal navigation that has no code", async () => {
    const res = await updateSession(new NextRequest("https://dobeu.net/login"));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("updateSession — /portal and /admin gating", () => {
  const ORIGINAL_ADMINS = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY = "anon-key";
    process.env.ADMIN_EMAILS = "admin@dobeu.net";
    h.getUser.mockReset();
    h.getAal.mockReset();
  });

  afterEach(() => {
    if (ORIGINAL_ADMINS === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL_ADMINS;
  });

  const signIn = (email: string) =>
    h.getUser.mockResolvedValue({ data: { user: { id: "u1", email } } });
  const run = (path: string) =>
    updateSession(new NextRequest(`https://dobeu.net${path}`));
  const target = (res: Response) =>
    new URL(res.headers.get("location") as string);

  it("redirects an unauthenticated /portal request to /login with next", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await run("/portal/projects");
    expect(res.status).toBe(307);
    const loc = target(res);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/portal/projects");
  });

  it("redirects an unauthenticated /admin request to /login with next", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await run("/admin/users");
    expect(res.status).toBe(307);
    const loc = target(res);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/admin/users");
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("redirects a non-admin email from /admin to /portal?error=not_authorized", async () => {
    signIn("client@example.com");
    const res = await run("/admin");
    expect(res.status).toBe(307);
    const loc = target(res);
    expect(loc.pathname).toBe("/portal");
    expect(loc.searchParams.get("error")).toBe("not_authorized");
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("sends an admin with no MFA factor to enrolment", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
    });
    const res = await run("/admin/invoices");
    expect(res.status).toBe(307);
    const loc = target(res);
    expect(loc.pathname).toBe("/portal/settings/mfa");
    expect(loc.searchParams.get("next")).toBe("/admin/invoices");
    expect(loc.searchParams.get("error")).toBeNull();
  });

  it("sends an AAL1 admin with a verified factor to step-up", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
    });
    const res = await run("/admin");
    expect(res.status).toBe(307);
    const loc = target(res);
    expect(loc.pathname).toBe("/portal/settings/mfa");
    expect(loc.searchParams.get("next")).toBe("/admin");
  });

  it("lets an AAL2 admin through", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
    });
    const res = await run("/admin");
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("fails closed when the assurance data is null", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockResolvedValue({ data: null });
    const res = await run("/admin");
    expect(res.status).toBe(307);
    const loc = target(res);
    expect(loc.pathname).toBe("/portal/settings/mfa");
    expect(loc.searchParams.get("next")).toBe("/admin");
  });

  it("fails closed when the assurance lookup throws", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockRejectedValue(new Error("boom"));
    const res = await run("/admin/leads");
    expect(res.status).toBe(307);
    const loc = target(res);
    expect(loc.pathname).toBe("/portal/settings/mfa");
    expect(loc.searchParams.get("error")).toBe("mfa_check_failed");
    expect(loc.searchParams.get("next")).toBe("/admin/leads");
  });

  it("does not redirect-loop on /portal/settings/mfa for an AAL1 admin", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
    });
    const res = await run("/portal/settings/mfa");
    expect(res.headers.get("location")).toBeNull();
    expect(h.getAal).not.toHaveBeenCalled();
  });
});

describe("updateSession — Supabase not configured", () => {
  beforeEach(() => {
    h.getUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects /admin to /login?error=supabase_not_configured when env vars are unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY", undefined);
    const res = await updateSession(new NextRequest("https://dobeu.net/admin"));
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location") as string);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("error")).toBe("supabase_not_configured");
    expect(h.getUser).not.toHaveBeenCalled();
  });
});
