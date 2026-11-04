import { config as loadEnv } from "dotenv";
import path from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

// Playwright does not load Next.js env files — pull Supabase keys for auth setup.
loadEnv({ path: path.resolve(__dirname, "../.env.local") });

export const SKIP_REASON =
  "Missing Supabase E2E env (NEXT_PUBLIC_VERCEL_SUPABASE_URL, NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY, VERCEL_SUPABASE_SERVICE_ROLE_KEY).";

export function resolveSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL ?? process.env.VERCEL_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY;
  const serviceKey = process.env.VERCEL_SUPABASE_SERVICE_ROLE_KEY;
  return { url, anonKey, serviceKey };
}

export const REMOTE_SKIP_REASON =
  "Supabase URL is not localhost/127.0.0.1; refusing to seed a remote project. Set E2E_ALLOW_REMOTE=1 to override.";

/** True for a local Supabase stack, or when E2E_ALLOW_REMOTE=1 is set. */
export function isSafeE2ETarget(): boolean {
  if (process.env.E2E_ALLOW_REMOTE === "1") return true;
  const { url } = resolveSupabaseEnv();
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function canRunSupabaseE2E(): boolean {
  const { url, anonKey, serviceKey } = resolveSupabaseEnv();
  return Boolean(url && anonKey && serviceKey) && isSafeE2ETarget();
}

/** Why the E2E must skip: missing env, or a non-local target. */
export function skipReason(): string {
  const { url, anonKey, serviceKey } = resolveSupabaseEnv();
  return url && anonKey && serviceKey ? REMOTE_SKIP_REASON : SKIP_REASON;
}

/** Service-role client for seeding and cleanup. Never use in app code. */
export function createServiceClient(): SupabaseClient {
  const { url, serviceKey } = resolveSupabaseEnv();
  if (!url || !serviceKey) throw new Error("Supabase env missing for E2E");
  if (!isSafeE2ETarget()) throw new Error(REMOTE_SKIP_REASON);
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/** Returns the user's id, creating the user first when missing. */
export async function ensureTestUser(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`E2E listUsers failed: ${error.message}`);

  const existing = data.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true
  });
  if (createError || !created.user) {
    throw new Error(`E2E createUser failed: ${createError?.message ?? "no user"}`);
  }
  return created.user.id;
}

/**
 * Signs `email` in with an AAL1 session: `generateLink` → server-side
 * `verifyOtp` → session cookies handed to the browser. The app is magic-link
 * only, so this is the only local sign-in path.
 */
export async function loginAs(page: Page, email: string, landingPath: string) {
  const { url, anonKey } = resolveSupabaseEnv();
  if (!url || !anonKey) throw new Error("Supabase env missing for E2E auth");

  const admin = createServiceClient();
  await ensureTestUser(admin, email);

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    throw new Error(`E2E generateLink failed: ${error?.message ?? "no hashed_token"}`);
  }

  // Admin links use the implicit flow (tokens in the URL fragment), which
  // /auth/callback does not handle. Verify the OTP server-side instead.
  const cookies = await verifyOtpCookies(url, anonKey, tokenHash);
  await page.context().addCookies(cookies);

  await page.goto(landingPath);
}

/** Exchanges a magic-link token hash for Supabase session cookies. */
async function verifyOtpCookies(url: string, anonKey: string, tokenHash: string) {
  const jar = new Map<string, { value: string; maxAge?: number }>();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, { value }]) => ({ name, value })),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          jar.set(name, { value, maxAge: options?.maxAge });
        }
      }
    }
  });

  let { error } = await client.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) {
    ({ error } = await client.auth.verifyOtp({ type: "email", token_hash: tokenHash }));
  }
  if (error) throw new Error(`E2E verifyOtp failed: ${error.message}`);
  if (jar.size === 0) throw new Error("E2E verifyOtp set no session cookies");

  const nowSeconds = Math.floor(Date.now() / 1000);
  return [...jar].map(([name, { value, maxAge }]) => ({
    name,
    value,
    domain: "localhost",
    path: "/",
    sameSite: "Lax" as const,
    httpOnly: false,
    ...(maxAge ? { expires: nowSeconds + maxAge } : {})
  }));
}
