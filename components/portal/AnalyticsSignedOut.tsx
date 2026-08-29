"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { resetAnalyticsUser } from "@/lib/analytics";

/**
 * Mounted on `/login`. A visitor who lands here without a Supabase session
 * (expired, revoked, or redirected by the middleware) may still carry a
 * previous user's analytics identity in the SDK cookies. Detach it so the
 * next login — possibly by a different person on a shared device — is not
 * attributed to the old account. `resetAnalyticsUser()` is a no-op for
 * anonymous devices, so the anonymous → identified merge is preserved.
 * Renders nothing.
 */
export function AnalyticsSignedOut() {
  React.useEffect(() => {
    let cancelled = false;
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && !data.session) resetAnalyticsUser();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
