/**
 * Intercom Messenger init + identify.
 * Consent-gated through AnalyticsProvider, same as Mixpanel and Datadog RUM.
 *
 * Setup once in the Intercom UI:
 *   Settings → Installation → For Web → copy the workspace App ID
 *   into Vercel env var NEXT_PUBLIC_INTERCOM_APP_ID.
 *
 * Secure Messenger (JWT): when INTERCOM_API_SECRET is set, boot via
 * initIntercomSecure with a server-signed intercom_user_jwt (visitors +
 * authenticated users). Legacy HMAC user_hash remains in lib/intercom-hmac.ts
 * but is superseded by JWT when the API secret is configured.
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
let secureBooted = false;

export function isIntercomConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_INTERCOM_APP_ID);
}

export function initIntercom(): void {
  if (typeof window === "undefined" || booted || secureBooted) return;
  const app_id = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
  if (!app_id) return;
  // Anonymous boot (legacy). Prefer initIntercomSecure when INTERCOM_API_SECRET is set.
  Intercom({ app_id });
  booted = true;
}

export function initIntercomSecure({ intercom_user_jwt }: { intercom_user_jwt: string }): void {
  if (typeof window === "undefined" || secureBooted) return;
  const app_id = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
  if (!app_id || !intercom_user_jwt) return;

  Intercom({
    app_id,
    api_base: "https://api-iam.intercom.io",
    intercom_user_jwt,
    session_duration: 86400000
  });
  secureBooted = true;
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
  /** @deprecated Legacy HMAC — prefer intercom_user_jwt when INTERCOM_API_SECRET is set. */
  user_hash?: string;
  /** Server-signed JWT for Intercom Secure Messenger. */
  intercom_user_jwt?: string;
}): void {
  if (!booted) {
    if (user.intercom_user_jwt) {
      initIntercomSecure({ intercom_user_jwt: user.intercom_user_jwt });
    } else {
      initIntercom();
    }
  }

  const updatePayload: Record<string, unknown> = {
    user_id: user.user_id,
    company: user.company ? { id: user.company, name: user.company } : undefined
  };

  if (user.intercom_user_jwt) {
    updatePayload.intercom_user_jwt = user.intercom_user_jwt;
  } else {
    updatePayload.email = user.email;
    updatePayload.name = user.name;
    updatePayload.created_at = user.created_at;
    updatePayload.user_hash = user.user_hash;
  }

  intercomUpdate(updatePayload);
}

export function shutdownIntercom(): void {
  if (!booted) return;
  intercomShutdown();
  booted = false;
  secureBooted = false;
}
