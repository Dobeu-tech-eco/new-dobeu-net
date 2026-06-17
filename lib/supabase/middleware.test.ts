import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * These tests exercise the defensive auth-code forwarder, which runs before any
 * Supabase client is constructed. With the Supabase env vars unset, the rest of
 * updateSession falls through to NextResponse.next() for public paths, so we can
 * isolate the forwarder behavior without mocking @supabase/ssr.
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
