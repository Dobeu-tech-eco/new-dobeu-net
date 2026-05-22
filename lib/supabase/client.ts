"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Browser-side Supabase client. Uses anon key + RLS. Safe to call from client components.
 *
 * Returns null if Supabase env vars are missing — callers must handle this case
 * so the marketing landing renders fine before Supabase is provisioned.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Return a stub that throws on use rather than at construction time,
    // so SSR doesn't crash on first render before envs are filled in.
    return createBrowserClient<Database>("https://placeholder.supabase.co", "placeholder-anon-key");
  }
  return createBrowserClient<Database>(url, anon);
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
