"use client";

import { useState, useEffect, useCallback } from "react";

export type ConsentCategory = "analytics" | "support" | "marketing";

export interface ConsentState {
  decided: boolean;
  analytics: boolean;
  support: boolean;
  marketing: boolean;
}

const COOKIE_NAME = "dobeu_cookie_consent";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function parseCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax; Secure`;
}

function readConsent(): ConsentState {
  const raw = parseCookie(COOKIE_NAME);
  if (!raw) return { decided: false, analytics: false, support: false, marketing: false };
  try {
    const parsed = JSON.parse(raw);
    return {
      decided: true,
      analytics: Boolean(parsed.analytics),
      support: Boolean(parsed.support),
      marketing: Boolean(parsed.marketing),
    };
  } catch {
    return { decided: false, analytics: false, support: false, marketing: false };
  }
}

/** Returns true if the browser has sent a Do Not Track signal. */
function isDNT(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.doNotTrack === "1" || (window as Window & { doNotTrack?: string }).doNotTrack === "yes";
}

export function useCookieConsent() {
  const [consent, setConsentState] = useState<ConsentState>({
    decided: false,
    analytics: false,
    support: false,
    marketing: false,
  });

  useEffect(() => {
    // If DNT is set, treat as denied without prompting the user.
    if (isDNT()) {
      setConsentState({ decided: true, analytics: false, support: false, marketing: false });
      return;
    }
    setConsentState(readConsent());
  }, []);

  const acceptAll = useCallback(() => {
    const state: ConsentState = { decided: true, analytics: true, support: true, marketing: true };
    writeCookie(COOKIE_NAME, JSON.stringify({ analytics: true, support: true, marketing: true }), COOKIE_MAX_AGE);
    setConsentState(state);
  }, []);

  const declineAll = useCallback(() => {
    const state: ConsentState = { decided: true, analytics: false, support: false, marketing: false };
    writeCookie(COOKIE_NAME, JSON.stringify({ analytics: false, support: false, marketing: false }), COOKIE_MAX_AGE);
    setConsentState(state);
  }, []);

  const savePreferences = useCallback((prefs: Omit<ConsentState, "decided">) => {
    const state: ConsentState = { decided: true, ...prefs };
    writeCookie(COOKIE_NAME, JSON.stringify(prefs), COOKIE_MAX_AGE);
    setConsentState(state);
  }, []);

  return { consent, acceptAll, declineAll, savePreferences, isDNT: isDNT() };
}
