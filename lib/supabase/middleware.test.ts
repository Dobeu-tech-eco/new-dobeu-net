import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAal: vi.fn(),
  setAllCookies: null as null | Array<{ name: string; value: string; options: object }>,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, opts: { cookies: { setAll: (c: unknown[]) => void } }) => ({
    auth: {
      getUser: async () => {
        // Simulate a session refresh when requested, like the real client.
        if (h.setAllCookies) opts.cookies.setAll(h.setAllCookies);
        return h.getUser();
      },
      mfa: { getAuthenticatorAssuranceLevel: h.getAal },
    },
  })),
}));

import { COMPANY_PATH_HEADER } from "@/lib/company-path";
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

  it("forwards a stray OTP token_hash to /auth/callback with its type and next", async () => {
    const res = await updateSession(
      new NextRequest("https://dobeu.net/?token_hash=th_abc&type=invite&next=%2Fcompany"),
    );
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") as string);
    expect(location.pathname).toBe("/auth/callback");
    expect(location.searchParams.get("token_hash")).toBe("th_abc");
    expect(location.searchParams.get("type")).toBe("invite");
    expect(location.searchParams.get("next")).toBe("/company");
  });

  it("keeps the GET forward Location byte-identical (raw query, no re-encoding)", async () => {
    const res = await updateSession(
      new NextRequest("https://dobeu.net/pricing?code=a;b&next=%2Fportal"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("x-action-redirect")).toBeNull();
    expect(res.headers.get("location")).toBe(
      "https://dobeu.net/auth/callback?code=a;b&next=%2Fportal",
    );
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

describe("updateSession — /company gating", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY = "anon-key";
    h.getUser.mockReset();
    h.getAal.mockReset();
  });

  const run = (path: string) => updateSession(new NextRequest(`https://dobeu.net${path}`));

  it("redirects signed-out /company to /login?next=/company", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await run("/company");
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location") as string);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/company");
  });

  it("keeps the encoded path and query in next, without leaking top-level params", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await run("/company/members?company=abc");
    const location = res.headers.get("location") as string;
    expect(location).toContain("next=%2Fcompany%2Fmembers%3Fcompany%3Dabc");
    const loc = new URL(location);
    expect(loc.searchParams.get("next")).toBe("/company/members?company=abc");
    expect(loc.searchParams.has("company")).toBe(false);
  });

  it("lets a signed-in user through with no MFA lookup", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" } } });
    const res = await run("/company/members");
    expect(res.headers.get("location")).toBeNull();
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("does not gate look-alike paths such as /companyfoo", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    const res = await run("/companyfoo");
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects /company to /login?error=supabase_not_configured when env vars are unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY", undefined);
    const res = await run("/company/members");
    const loc = new URL(res.headers.get("location") as string);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("error")).toBe("supabase_not_configured");
    expect(h.getUser).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe("updateSession — forwarded company path header", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY = "anon-key";
    h.getUser.mockReset();
    h.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" } } });
    h.setAllCookies = null;
  });

  afterEach(() => {
    h.setAllCookies = null;
  });

  // Next encodes request-header overrides on the response: the names of every
  // forwarded header in x-middleware-override-headers, each value in
  // x-middleware-request-<name>.
  const forwarded = (res: Response, name: string) => {
    const overrides = (res.headers.get("x-middleware-override-headers") ?? "").split(",");
    return overrides.includes(name) ? res.headers.get(`x-middleware-request-${name}`) : null;
  };
  const run = (path: string, headers: Record<string, string> = {}) =>
    updateSession(new NextRequest(`https://dobeu.net${path}`, { headers }));

  it("forwards the requested /company path and query to the downstream request", async () => {
    const res = await run("/company/members?company=x");
    expect(forwarded(res, COMPANY_PATH_HEADER)).toBe("/company/members?company=x");
  });

  it("overwrites a spoofed inbound header on /company", async () => {
    const res = await run("/company", { [COMPANY_PATH_HEADER]: "/company/members?company=evil" });
    expect(forwarded(res, COMPANY_PATH_HEADER)).toBe("/company");
  });

  it.each(["/portal", "/"])("strips a spoofed header on non-company path %s", async (path) => {
    const res = await run(path, { [COMPANY_PATH_HEADER]: "/company/members" });
    expect(forwarded(res, COMPANY_PATH_HEADER)).toBeNull();
  });

  it("keeps the header when setAll re-creates the response (session refresh)", async () => {
    h.setAllCookies = [{ name: "sb-token", value: "v", options: {} }];
    const res = await run("/company/members?company=x");
    expect(res.cookies.get("sb-token")?.value).toBe("v");
    expect(forwarded(res, COMPANY_PATH_HEADER)).toBe("/company/members?company=x");
  });

  it("strips a spoofed header when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY", undefined);
    const res = await run("/", { [COMPANY_PATH_HEADER]: "/company" });
    expect(forwarded(res, COMPANY_PATH_HEADER)).toBeNull();
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

  it("keeps the GET Location byte-identical", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY", undefined);
    const res = await updateSession(new NextRequest("https://dobeu.net/portal/projects?a=1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://dobeu.net/login?a=1&error=supabase_not_configured",
    );
  });
});

describe("updateSession — signed-out server-action POSTs", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY = "anon-key";
    process.env.ADMIN_EMAILS = "admin@dobeu.net";
    h.getUser.mockReset();
    h.getAal.mockReset();
    h.getUser.mockResolvedValue({ data: { user: null } });
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  const action = (path: string, method = "POST") =>
    updateSession(
      new NextRequest(`https://dobeu.net${path}`, {
        method,
        headers: { "next-action": "abc" },
      }),
    );
  const parse = (res: Response) => {
    const header = res.headers.get("x-action-redirect") as string;
    const i = header.lastIndexOf(";");
    return {
      type: header.slice(i + 1),
      url: new URL(header.slice(0, i), "https://dobeu.net"),
    };
  };

  it("answers a /portal action POST with 303 + x-action-redirect and no location", async () => {
    const res = await action("/portal/tickets/new");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-action-redirect")).toBe(
      "/login?next=%2Fportal%2Ftickets%2Fnew;push",
    );
  });

  it("does the same for /admin without checking AAL", async () => {
    const res = await action("/admin/invoices");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-action-redirect")).toBe("/login?next=%2Fadmin%2Finvoices;push");
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("keeps the /company query in next", async () => {
    const res = await action("/company/members?company=x");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBeNull();
    const { type, url } = parse(res);
    expect(type).toBe("push");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/company/members?company=x");
  });

  it("keeps the header parseable when the query carries ; or &", async () => {
    const res = await action("/portal/tickets?a=1;b=2&c=3");
    expect(res.status).toBe(303);
    const { type, url } = parse(res);
    expect(type).toBe("push");
    expect(url.searchParams.get("next")).toBe("/portal/tickets?a=1;b=2&c=3");
  });

  it("falls back to the gate root when next fails sanitizeNextPath", async () => {
    const res = await action("/company/members?x=%0A%5C");
    expect(res.status).toBe(303);
    expect(parse(res).url.searchParams.get("next")).toBe("/company");
  });

  it("leaves a POST without next-action as a 307", async () => {
    const res = await updateSession(
      new NextRequest("https://dobeu.net/portal", { method: "POST" }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("x-action-redirect")).toBeNull();
    const loc = new URL(res.headers.get("location") as string);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/portal");
  });

  it("leaves a GET with a next-action header as a 307", async () => {
    const res = await action("/portal", "GET");
    expect(res.status).toBe(307);
    expect(res.headers.get("x-action-redirect")).toBeNull();
    expect(res.headers.get("location")).not.toBeNull();
  });

  it("passes a signed-in action POST through", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" } } });
    const res = await action("/portal");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-action-redirect")).toBeNull();
  });

  it("answers an action POST carrying a stray code with 303 + x-action-redirect to /auth/callback", async () => {
    const res = await action("/portal?code=pkce-1&next=%2Fportal%2Ftickets");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBeNull();
    expect(h.getUser).not.toHaveBeenCalled();
    const { type, url } = parse(res);
    expect(type).toBe("push");
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("code")).toBe("pkce-1");
    expect(url.searchParams.get("next")).toBe("/portal/tickets");
  });

  it("answers an action POST carrying a stray token_hash the same way, ; encoded", async () => {
    const res = await action("/?token_hash=th;1&type=invite");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBeNull();
    const header = res.headers.get("x-action-redirect") as string;
    expect(header.split(";")).toHaveLength(2);
    const { type, url } = parse(res);
    expect(type).toBe("push");
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("token_hash")).toBe("th;1");
    expect(url.searchParams.get("type")).toBe("invite");
  });

  it("leaves a GET with a next-action header on the stray-code forwarder as a 307", async () => {
    const res = await action("/?code=abc", "GET");
    expect(res.status).toBe(307);
    expect(res.headers.get("x-action-redirect")).toBeNull();
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/auth/callback");
  });

  it.each(["/portal/tickets/new", "/admin/invoices", "/company/members"])(
    "answers an action POST on %s with Supabase unconfigured with 303 + x-action-redirect",
    async (path) => {
      vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_URL", undefined);
      vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY", undefined);
      try {
        const res = await action(path);
        expect(res.status).toBe(303);
        expect(res.headers.get("location")).toBeNull();
        expect(res.headers.get("x-action-redirect")).toBe(
          "/login?error=supabase_not_configured;push",
        );
        expect(h.getUser).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it("leaves a non-action POST with Supabase unconfigured as a 307", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY", undefined);
    try {
      const res = await updateSession(
        new NextRequest("https://dobeu.net/portal", { method: "POST" }),
      );
      expect(res.status).toBe(307);
      expect(res.headers.get("x-action-redirect")).toBeNull();
      const loc = new URL(res.headers.get("location") as string);
      expect(loc.pathname).toBe("/login");
      expect(loc.searchParams.get("error")).toBe("supabase_not_configured");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("still sends a signed-in non-admin action POST on /admin to /portal?error=not_authorized", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" } } });
    const res = await action("/admin");
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location") as string);
    expect(loc.pathname).toBe("/portal");
    expect(loc.searchParams.get("error")).toBe("not_authorized");
  });
});
