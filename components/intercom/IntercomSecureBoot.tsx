"use client";

import * as React from "react";
import { initIntercom, initIntercomSecure } from "@/lib/intercom";

const CONSENT_KEY = "dobeu-analytics-consent";

/**
 * Boots Intercom Secure Messenger with a server-signed JWT after analytics consent.
 * Fetches a visitor or authenticated-user token from /api/intercom/jwt.
 */
export function IntercomSecureBoot() {
  const [consent, setConsent] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored === "granted") setConsent(true);
    else if (stored === "denied") setConsent(false);
  }, []);

  React.useEffect(() => {
    if (consent !== true) return;

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
  }, [consent]);

  return null;
}
