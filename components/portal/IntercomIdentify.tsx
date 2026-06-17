"use client";

import * as React from "react";
import { identifyIntercom } from "@/lib/intercom";

/**
 * Client component that identifies the authenticated user with Intercom.
 *
 * Mounted from server layouts that already resolved the Supabase user
 * (`app/portal/layout.tsx`, `app/admin/layout.tsx`). Renders nothing.
 *
 * Consent gating: Intercom boots via `IntercomSecureBoot` in
 * `components/analytics-provider.tsx` after cookie consent. This component
 * re-identifies with the server-signed JWT plus profile fields.
 */
export interface IntercomIdentifyProps {
  user_id: string;
  email?: string;
  name?: string;
  /** ISO string (e.g. Supabase `user.created_at`). Converted to Unix seconds. */
  created_at?: string;
  /** Server-signed JWT for Intercom Secure Messenger. */
  intercom_user_jwt?: string;
}

export function IntercomIdentify({
  user_id,
  email,
  name,
  created_at,
  intercom_user_jwt
}: IntercomIdentifyProps) {
  React.useEffect(() => {
    identifyIntercom({
      user_id,
      email,
      name,
      created_at: created_at ? Math.floor(new Date(created_at).getTime() / 1000) : undefined,
      intercom_user_jwt
    });
  }, [user_id, email, name, created_at, intercom_user_jwt]);

  return null;
}
