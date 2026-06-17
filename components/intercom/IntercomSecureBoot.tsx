"use client";

import * as React from "react";
import { initIntercom, initIntercomSecure } from "@/lib/intercom";

/**
 * Boots Intercom Secure Messenger with a server-signed JWT after analytics consent.
 */
export function IntercomSecureBoot({ enabled }: { enabled: boolean }) {
  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/intercom/jwt", { credentials: "same-origin" });
        if (cancelled) return;
        if (res.status === 503) {
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
