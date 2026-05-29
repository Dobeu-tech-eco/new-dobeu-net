"use client";

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
 */

import Intercom, {
  update as intercomUpdate,
  shutdown as intercomShutdown,
} from "@intercom/messenger-js-sdk";

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
  company?: string;
  // user_hash from server when identity verification is on
  user_hash?: string;
}): void {
  if (!booted) initIntercom();
  intercomUpdate({
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    company: user.company
      ? { id: user.company, name: user.company }
      : undefined,
    user_hash: user.user_hash,
  });
}

export function shutdownIntercom(): void {
  if (!booted) return;
  intercomShutdown();
  booted = false;
}
