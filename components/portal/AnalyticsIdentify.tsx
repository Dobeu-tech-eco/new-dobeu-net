"use client";

import * as React from "react";
import { identifyUser } from "@/lib/analytics";

/**
 * Client component that attaches the authenticated Supabase user to the
 * analytics fan-out (Amplitude `setUserId` + identify, PostHog, Mixpanel).
 *
 * Mounted from server layouts that already resolved the user
 * (`app/portal/layout.tsx`, `app/admin/layout.tsx`). Renders nothing.
 *
 * Consent gating lives in `lib/analytics.ts`: the identity is held until the
 * visitor grants the "analytics" cookie category and the SDKs finish loading.
 */
export interface AnalyticsIdentifyProps {
  user_id: string;
  email?: string;
  is_admin?: boolean;
}

export function AnalyticsIdentify({ user_id, email, is_admin }: AnalyticsIdentifyProps) {
  React.useEffect(() => {
    identifyUser({ userId: user_id, email, isAdmin: is_admin });
  }, [user_id, email, is_admin]);

  return null;
}
