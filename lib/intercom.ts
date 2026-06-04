/**
 * Intercom Messenger init + identify.
 * Consent-gated through AnalyticsProvider, same as Mixpanel and Datadog RUM.
 *
 * Setup once in the Intercom UI:
 *   Settings → Installation → For Web → copy the workspace App ID
 *   into Vercel env var NEXT_PUBLIC_INTERCOM_APP_ID.
 *
 * Identity verification (HMAC) is recommended for the /portal logged-in users.
 * For v1 we boot anonymously on the marketing pages and identify on /portal
 * once the Supabase session is loaded. HMAC wiring lives in the portal layout
 * once we expose INTERCOM_IDENTITY_VERIFICATION_SECRET server-side.
 *
 * Note: this module is intentionally NOT marked `"use client"` so that the
 * pure helper `intercomNameFromUser` can be imported from server components
 * (admin + portal layouts). The SDK methods themselves no-op safely on the
 * server (`typeof window === "undefined"` guards), and the client-side init
 * paths are only ever invoked from `"use client"` consumers.
 */

import Intercom, { update as intercomUpdate, shutdown as intercomShutdown } from "@intercom/messenger-js-sdk";

/**
 * Pick a stable display name to send to Intercom for an authed Supabase user.
 * Prefers `user_metadata.full_name` → `user_metadata.name` → email. Server-safe
 * (no DOM access). Shared by `app/portal/layout.tsx` and `app/admin/layout.tsx`
 * so both surfaces compute the same name and any future tweak lands in one place.
 */
export function intercomNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | undefined {
  const meta = user.user_metadata ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name : undefined;
  const name = typeof meta.name === "string" ? meta.name : undefined;
  return fullName ?? name ?? user.email ?? undefined;
}

let booted = false;

export function isIntercomConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_INTERCOM_APP_ID);
}

export function initIntercom(): void {
  if (typeof window === "undefined" || booted) return;
  const app_id = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
  if (!app_id) return;
  // Anonymous boot. Identified users call `identifyIntercom` after login.
  Intercom({ app_id });
  booted = true;
}

export function identifyIntercom(user: {
  user_id: string;
  email?: string;
  name?: string;
  /**
   * Unix timestamp **in seconds** (Intercom's required format), e.g. 1704067200.
   * Pass `Math.floor(new Date(supabaseUser.created_at).getTime() / 1000)`.
   */
  created_at?: number;
  company?: string;
  /** HMAC user_hash from server when Intercom identity verification is on. */
  user_hash?: string;
}): void {
  if (!booted) initIntercom();
  intercomUpdate({
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    created_at: user.created_at,
    company: user.company ? { id: user.company, name: user.company } : undefined,
    user_hash: user.user_hash
  });
}

export function shutdownIntercom(): void {
  if (!booted) return;
  intercomShutdown();
  booted = false;
}
