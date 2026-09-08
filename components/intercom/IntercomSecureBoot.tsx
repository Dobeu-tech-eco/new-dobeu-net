"use client";

import * as React from "react";
import { initIntercom, initIntercomSecure } from "@/lib/intercom";

/**
 * Boots Intercom after support consent: with a server-signed JWT for
 * authenticated users, or as a plain visitor when the JWT route returns 204.
 */
export function IntercomSecureBoot({ enabled }: { enabled: boolean }) {
  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/intercom/jwt", { credentials: "same-origin" });
        if (cancelled) return;
        // 503 = secure messenger not configured; 204 = anonymous visitor.
        // Both mean "boot without a JWT" (visitors stay Visitors/Leads).
        if (res.status === 503 || res.status === 204) {
          initIntercom();
          return;
        }
        if (!res.ok) return;
        const { token } = (await res.json()) as { token?: string };
        if (token && !cancelled) initIntercomSecure({ intercom_user_jwt: token });
      } catch {
        // Non-fatal — messenger stays unavailable until retry/navigation
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return null;
}
