"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Browser-side Supabase client. Uses anon key + RLS. Safe to call from client components.
 *
 * Returns a placeholder client (that throws on use rather than at construction time)
 * if the Vercel-managed Supabase env vars are missing — so SSR doesn't crash on first
 * render before envs are filled in.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return createBrowserClient<Database>(
      "https://placeholder.supabase.co",
      "placeholder-anon-key"
    );
  }
  return createBrowserClient<Database>(url, anon);
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY
  );
}
