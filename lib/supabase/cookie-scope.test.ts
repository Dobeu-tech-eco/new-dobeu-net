// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { createClient } from "./server";
import { updateSession } from "./middleware";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

// Reserved .test TLD: even if the fetch stub were bypassed, nothing real could answer.
const url = "https://cookiescope.supabase.test";
const key = "placeholder-anon-key";
const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const user = {
  id: "11111111-1111-4111-8111-111111111111", aud: "authenticated",
  role: "authenticated", email: "cookie@example.test", app_metadata: {},
  user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
};
function jwt(exp: number) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp, sub: user.id, role: "authenticated", aal: "aal1", session_id: "22222222-2222-4222-8222-222222222222" })}.placeholder`;
}
type Write = { name: string; value: string } & Pick<CookieOptions, "domain" | "path" | "sameSite">;
let seededValue: string;
let newToken: string;
let refreshHits: number;
let unexpected: string[];

function seedCookies() { return [{ name: storageKey, value: seededValue }]; }
function assertHostOnly(writes: Write[]) {
  expect(writes.length).toBeGreaterThan(0);
  for (const write of writes) {
    expect(write.domain).toBeUndefined();
    expect(write.path).toBe("/");
    expect(String(write.sameSite).toLowerCase()).toBe("lax");
  }
  const sessionWrites = writes.filter((write) => write.name.startsWith(storageKey) && write.value !== "");
  expect(sessionWrites.length).toBeGreaterThan(0);
  const whole = sessionWrites.find((write) => write.name === storageKey);
  const encoded = whole?.value ?? sessionWrites
    .filter((write) => /^\.\d+$/.test(write.name.slice(storageKey.length)))
    .sort((a, b) => Number(a.name.slice(storageKey.length + 1)) - Number(b.name.slice(storageKey.length + 1)))
    .map((write) => write.value).join("");
  expect(encoded).toMatch(/^base64-/);
  const session = JSON.parse(Buffer.from(encoded.slice(7), "base64url").toString());
  expect(session.access_token).toBe(newToken);
}
function assertNetwork() {
  expect(refreshHits).toBe(1);
  expect(unexpected).toEqual([]);
}
beforeEach(() => {
  expect(typeof window).toBe("undefined");
  vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_URL", url);
  vi.stubEnv("VERCEL_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY", key);
  unexpected = [];
  refreshHits = 0;
  const now = Math.floor(Date.now() / 1000);
  newToken = jwt(now + 3600);
  const refreshed = { access_token: newToken, refresh_token: "new-placeholder-refresh", expires_in: 3600, expires_at: now + 3600, token_type: "bearer", user };
  seededValue = `base64-${Buffer.from(JSON.stringify({ ...refreshed, access_token: jwt(now - 60), refresh_token: "seed-placeholder-refresh", expires_at: now - 60 })).toString("base64url")}`;
  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const method = request.method.toUpperCase();
    if (method === "POST" && request.url === `${url}/auth/v1/token?grant_type=refresh_token` &&
        (await request.clone().json()).refresh_token === "seed-placeholder-refresh") {
      refreshHits++;
      return Response.json(refreshed);
    }
    if (method === "GET" && request.url === `${url}/auth/v1/user` && request.headers.get("authorization") === `Bearer ${newToken}`) {
      return Response.json(user);
    }
    const message = `unexpected fetch: ${method} ${request.url}`;
    unexpected.push(message);
    throw new Error(message);
  };
  vi.stubGlobal("fetch", fakeFetch);
});
afterEach(() => {
  try { expect(unexpected).toEqual([]); }
  finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  }
});

describe("host-only refreshed session cookies", () => {
  it("preserves host-only scope through middleware, including raw Set-Cookie", async () => {
    const res = await updateSession(new NextRequest("https://dobeu.net/portal", { headers: { cookie: `${storageKey}=${seededValue}` } }));
    expect(res.status).toBe(200);
    expect(res.headers.has("location")).toBe(false);
    assertNetwork();
    assertHostOnly(res.cookies.getAll());
    const raw = res.headers.getSetCookie();
    expect(raw.length).toBeGreaterThan(0);
    for (const line of raw) {
      expect(line).not.toMatch(/;\s*domain=/i);
      expect(line).toMatch(/;\s*path=\/(;|$)/i);
      expect(line).toMatch(/;\s*samesite=lax/i);
    }
  });
  it("preserves host-only scope through the server cookie store", async () => {
    const writes: Write[] = [];
    const store = { getAll: seedCookies, set: (name: string, value: string, options: CookieOptions) => { writes.push({ name, value, ...options }); } };
    vi.mocked(cookies).mockResolvedValue(store as unknown as Awaited<ReturnType<typeof cookies>>);
    const { data, error } = await (await createClient()).auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(user.id);
    assertNetwork();
    assertHostOnly(writes);
  });
  it("negative control detects an explicit Domain attribute", async () => {
    const writes: Write[] = [];
    const client = createServerClient(url, key, {
      cookies: { getAll: seedCookies, setAll: (items) => { writes.push(...items.map(({ name, value, options }) => ({ name, value, ...options }))); } },
      cookieOptions: { domain: ".dobeu.net" },
    });
    const { data, error } = await client.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe(user.id);
    assertNetwork();
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) expect(write.domain).toBe(".dobeu.net");
    expect(() => assertHostOnly(writes)).toThrow();
    // Also prove the refreshed-token assertion passes once only Domain is removed.
    assertHostOnly(writes.map(({ ...write }) => ({ ...write, domain: undefined })));
  });
});
