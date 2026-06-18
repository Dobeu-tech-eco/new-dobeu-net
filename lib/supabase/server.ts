import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Use in Server Components, Route Handlers, and Server Actions.
 *
 * Env-var convention: provisioned by the Vercel Marketplace Supabase
 * integration (`VERCEL_SUPABASE_*`). The browser-exposed mirror
 * `NEXT_PUBLIC_VERCEL_SUPABASE_URL` is used as the URL fallback so
 * server and client read the same value.
 */
function resolveSupabaseUrl(): string {
  const url =
    process.env.VERCEL_SUPABASE_URL ?? process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "VERCEL_SUPABASE_URL (or NEXT_PUBLIC_VERCEL_SUPABASE_URL) missing — cannot create Supabase server client."
    );
  }
  return url;
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    resolveSupabaseUrl(),
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware will refresh.
          }
        }
      }
    }
  );
}

/**
 * Service-role Supabase client. Server-only. Bypasses RLS.
 * Use ONLY for admin operations and webhook handlers.
 */
export function createAdminClient() {
  if (!process.env.VERCEL_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "VERCEL_SUPABASE_SERVICE_ROLE_KEY missing — cannot create admin client."
    );
  }
  return createServerClient<Database>(
    resolveSupabaseUrl(),
    process.env.VERCEL_SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: { getAll: () => [], setAll: () => {} }
    }
  );
}
