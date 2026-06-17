"use client";

import * as React from "react";
import { identifyIntercom } from "@/lib/intercom";

/**
 * Client component that identifies the authenticated user with Intercom.
 *
 * Mounted from server layouts that already resolved the Supabase user
 * (`app/portal/layout.tsx`, `app/admin/layout.tsx`). Renders nothing.
 *
 * Consent gating: `lib/intercom.ts#initIntercom` already no-ops until the
 * cookie-consent banner has been accepted (it returns early if Intercom
 * isn't configured + booted). The boot itself is wired in
 * `components/analytics-provider.tsx`. So this component is safe to mount
 * unconditionally — if the user hasn't consented, the SDK isn't loaded and
 * `identifyIntercom` short-circuits.
 *
 * Identity verification (HMAC `user_hash`) is recommended for production —
 * pipe it in from the server when `INTERCOM_IDENTITY_VERIFICATION_SECRET`
 * is set.
 */
export interface IntercomIdentifyProps {
  user_id: string;
  email?: string;
  name?: string;
  /** ISO string (e.g. Supabase `user.created_at`). Converted to Unix seconds. */
  created_at?: string;
  user_hash?: string;
}

export function IntercomIdentify({
  user_id,
  email,
  name,
  created_at,
  user_hash
}: IntercomIdentifyProps) {
  React.useEffect(() => {
    identifyIntercom({
      user_id,
      email,
      name,
      created_at: created_at ? Math.floor(new Date(created_at).getTime() / 1000) : undefined,
      user_hash
    });
  }, [user_id, email, name, created_at, user_hash]);

  return null;
}
