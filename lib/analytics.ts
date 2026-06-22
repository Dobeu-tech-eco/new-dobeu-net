/**
 * Unified analytics fan-out. Every event call goes here and gets dispatched
 * to PostHog (product) + Mixpanel (funnel) + GA4 (acquisition) + dataLayer (GTM).
 *
 * Browser-only SDKs (posthog-js, mixpanel-browser) are loaded lazily via
 * dynamic import() so they are NEVER evaluated during server-side rendering /
 * prerendering — both touch `window`/`document` at module scope and would
 * otherwise crash the build with "window is not defined".
 *
 * Sensitive server-side events (bookings, payments) are not tracked here;
 * add a dedicated server module if that becomes necessary.
 */
"use client";

import { getPosthogHost } from "@/lib/utils";

type EventProps = Record<string, string | number | boolean | null | undefined>;

// Lazily-resolved SDK singletons. Stay null until init runs in the browser.
type PostHog = typeof import("posthog-js")["default"];
type Mixpanel = typeof import("mixpanel-browser")["default"];
let posthog: PostHog | null = null;
let mixpanel: Mixpanel | null = null;

let initialized = false;
let consentGranted = false;

export async function initAnalytics(consent: boolean): Promise<void> {
  if (typeof window === "undefined" || initialized) return;

  // Only fire analytics if the user has consented.
  if (!consent) return;

  // ---- PostHog ----
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    const mod = await import("posthog-js");
    posthog = mod.default;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: getPosthogHost(),
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      person_profiles: "identified_only",
      session_recording: { recordCrossOriginIframes: false }
    });
  }

  // ---- Mixpanel ----
  // Autocapture + session replay enabled per Jeremy's product analytics setup.
  // Token: dobeu.net workspace (project token, safe in NEXT_PUBLIC_).
  if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
    const mod = await import("mixpanel-browser");
    mixpanel = mod.default;
    mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV === "development",
      track_pageview: true,
      persistence: "localStorage",
      autocapture: true,
      record_sessions_percent: 100
    });
  }

  // ---- GA4 (via gtag) and GTM are loaded via <Script> in app/layout.tsx ----

  initialized = true;
  consentGranted = true;
}

export function setAnalyticsConsent(consent: boolean): void {
  consentGranted = consent;
  if (consent) void initAnalytics(true);
}

export function track(eventName: string, props: EventProps = {}): void {
  if (typeof window === "undefined" || !consentGranted) return;
  try {
    if (posthog && process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog.capture(eventName, props);
    if (mixpanel && process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) mixpanel.track(eventName, props);
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, props);
    }
    pushToDataLayer({ event: eventName, ...props });
  } catch (e) {
    console.warn(`[analytics.track] ${eventName} failed`, e);
  }
}

export function pageView(path: string): void {
  track("$pageview", { $current_url: path });
}

function pushToDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === "undefined" || !consentGranted) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag: (...args: unknown[]) => void;
  }
}
