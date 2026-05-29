/**
 * Unified analytics fan-out. Every event call goes here and gets dispatched
 * to PostHog (product) + Mixpanel (funnel) + GA4 (acquisition) + dataLayer (GTM).
 *
 * Server-only fanout for sensitive events (bookings, payments) lives at
 * lib/analytics-server.ts to keep keys off the client.
 */
"use client";

import posthog from "posthog-js";
import mixpanel from "mixpanel-browser";

type EventProps = Record<string, string | number | boolean | null | undefined>;

let initialized = false;

export function initAnalytics(consent: boolean): void {
  if (typeof window === "undefined" || initialized) return;

  // Only fire analytics if the user has consented.
  if (!consent) return;

  // ---- PostHog ----
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      person_profiles: "identified_only",
      session_recording: { recordCrossOriginIframes: false },
    });
  }

  // ---- Mixpanel ----
  // Autocapture + session replay enabled per Jeremy's product analytics setup.
  // Token: dobeu.net workspace (project token, safe in NEXT_PUBLIC_).
  if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
    mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV === "development",
      track_pageview: true,
      persistence: "localStorage",
      autocapture: true,
      record_sessions_percent: 100,
    });
  }

  // ---- GA4 (via gtag) and GTM are loaded via <Script> in app/layout.tsx ----

  initialized = true;
}

export function identify(userId: string, traits: EventProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog.identify(userId, traits);
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      mixpanel.identify(userId);
      mixpanel.people.set(traits);
    }
    if (typeof window.gtag === "function") {
      window.gtag("set", "user_properties", traits);
    }
    pushToDataLayer({ event: "identify", user_id: userId, ...traits });
  } catch (e) {
    console.warn("[analytics.identify] failed", e);
  }
}

export function track(eventName: string, props: EventProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog.capture(eventName, props);
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN)
      mixpanel.track(eventName, props);
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
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag: (...args: unknown[]) => void;
  }
}
