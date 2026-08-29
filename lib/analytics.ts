/**
 * Unified analytics fan-out. Every event call goes here and gets dispatched
 * to PostHog (product) + Mixpanel (funnel) + Amplitude (product + replay) +
 * GA4 (acquisition) + dataLayer (GTM).
 *
 * Browser-only SDKs (posthog-js, mixpanel-browser, @amplitude/unified) are
 * loaded lazily via dynamic import() so they are NEVER evaluated during
 * server-side rendering / prerendering — they touch `window`/`document` at
 * module scope and would otherwise crash the build with "window is not defined".
 *
 * Consent model (see components/analytics-provider.tsx + hooks/use-cookie-consent.ts):
 *   - Nothing initializes until the visitor grants the "analytics" category.
 *   - If consent is later withdrawn, every SDK is switched to its opt-out
 *     mode so autocaptured events (which bypass `track()`) stop too — even if
 *     the withdrawal lands while the SDKs are still being imported.
 *
 * Identity (see components/portal/AnalyticsIdentify.tsx + AnalyticsSignedOut.tsx):
 *   - `identifyUser()` attaches the verified Supabase user id; held until consent.
 *   - `resetAnalyticsUser()` detaches it on any sign-out path (button, other tab,
 *     expired session) and is a no-op for anonymous devices.
 *
 * Sensitive server-side events (bookings, payments) are not tracked here;
 * add a dedicated server module if that becomes necessary.
 */
"use client";

import { getPosthogHost } from "@/lib/utils";

type EventProps = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsUser {
  /** Stable, verified identifier — the Supabase auth user id. */
  readonly userId: string;
  readonly email?: string;
  readonly isAdmin?: boolean;
}

// Lazily-resolved SDK singletons. Stay null until init runs in the browser.
type PostHog = typeof import("posthog-js")["default"];
type Mixpanel = typeof import("mixpanel-browser")["default"];
type Amplitude = typeof import("@amplitude/unified");
let posthog: PostHog | null = null;
let mixpanel: Mixpanel | null = null;
let amplitude: Amplitude | null = null;

let initialized = false;
let consentGranted = false;
/** Single-flight SDK load so concurrent callers never double-initialize. */
let initPromise: Promise<void> | null = null;
/** Last identified user; re-applied once the SDKs finish loading after consent. */
let currentUser: AnalyticsUser | null = null;
/** A reset requested before the SDKs loaded; applied as soon as they do. */
let resetPending = false;

/** Synthetic PostHog-style page view — Amplitude autocaptures page views itself. */
const PAGEVIEW_EVENT = "$pageview";
/** Mixpanel persists the identified user under this super property. */
const MIXPANEL_USER_ID_PROPERTY = "$user_id";

/**
 * Amplitude Session Replay share of sessions to record (0–1). Amplitude's
 * remote Session Replay setting overrides this without a deploy.
 * Starter plan quota: 1,000 replays / month.
 */
const DEFAULT_REPLAY_SAMPLE_RATE = 1;
const MIN_SAMPLE_RATE = 0;
const MAX_SAMPLE_RATE = 1;

/**
 * Explicit Amplitude Autocapture config (Browser SDK 2.x). Listed in full so
 * the event footprint is visible in code review; remote config in Amplitude
 * (Settings → Autocapture) can still toggle these at runtime.
 */
const AMPLITUDE_AUTOCAPTURE = {
  attribution: true, // UTM / click IDs / referrer → user + event properties
  pageViews: true, // `[Amplitude] Page Viewed`, incl. Next.js route changes
  sessions: true, // `[Amplitude] Start/End Session` (required for replay)
  formInteractions: true, // `[Amplitude] Form Started / Submitted`
  fileDownloads: true,
  elementInteractions: true, // `[Amplitude] Element Clicked` (Visual Labeling / heatmaps)
  frustrationInteractions: true, // rage clicks + dead clicks
  webVitals: true, // LCP / CLS / INP as `[Amplitude] Web Vitals`
  networkTracking: false // noisy on a marketing site; enable remotely when debugging
} as const;

export function getAmplitudeReplaySampleRate(
  raw: string | undefined = process.env.NEXT_PUBLIC_AMPLITUDE_REPLAY_SAMPLE_RATE
): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_REPLAY_SAMPLE_RATE;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return DEFAULT_REPLAY_SAMPLE_RATE;
  return Math.min(MAX_SAMPLE_RATE, Math.max(MIN_SAMPLE_RATE, parsed));
}

async function initPosthog(apiKey: string): Promise<void> {
  const mod = await import("posthog-js");
  posthog = mod.default;
  posthog.init(apiKey, {
    api_host: getPosthogHost(),
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: "identified_only",
    session_recording: { recordCrossOriginIframes: false }
  });
}

// Autocapture + session replay enabled per Jeremy's product analytics setup.
// Token: dobeu.net workspace (project token, safe in NEXT_PUBLIC_).
async function initMixpanel(token: string): Promise<void> {
  const mod = await import("mixpanel-browser");
  mixpanel = mod.default;
  mixpanel.init(token, {
    debug: process.env.NODE_ENV === "development",
    track_pageview: true,
    persistence: "localStorage",
    autocapture: true,
    record_sessions_percent: 100
  });
}

/**
 * Amplitude via @amplitude/unified (Analytics + Session Replay). Runs once,
 * client-side, after consent. Key is the public browser API key (safe in
 * NEXT_PUBLIC_). Guides & Surveys is skipped (unused) so the SDK writes no
 * `amplitude.engagement.*` storage and makes no extra network calls.
 */
async function initAmplitude(apiKey: string): Promise<void> {
  const mod = await import("@amplitude/unified");
  amplitude = mod;
  await amplitude.initAll(apiKey, {
    serverZone: "US",
    analytics: {
      autocapture: AMPLITUDE_AUTOCAPTURE,
      logLevel:
        process.env.NODE_ENV === "development"
          ? mod.Types.LogLevel.Debug
          : mod.Types.LogLevel.Warn
    },
    sessionReplay: { sampleRate: getAmplitudeReplaySampleRate() },
    engagement: { skip: true }
  });
}

/**
 * Load the SDKs once the visitor has consented. Single-flight: concurrent
 * callers (AnalyticsProvider + setAnalyticsConsent, React strict-mode double
 * effects) share one in-flight load, and consent is re-read after the awaits
 * so a withdrawal that lands while the imports are pending wins.
 */
export function initAnalytics(consent: boolean): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  consentGranted = consent;
  if (!consent || initialized) return Promise.resolve();
  if (!initPromise) initPromise = loadSdks().then(finishInit, handleInitFailure);
  return initPromise;
}

async function loadSdks(): Promise<void> {
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) await initPosthog(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) await initMixpanel(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN);
  if (process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY) {
    await initAmplitude(process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY);
  }
  // ---- GA4 (via gtag) and GTM are loaded via <Script> in app/layout.tsx ----
}

function finishInit(): void {
  initialized = true;
  // Consent may have been withdrawn while the SDKs were still loading.
  if (!consentGranted) {
    applyOptOut(true);
    return;
  }
  if (resetPending) detachIdentity();
  if (currentUser) applyIdentity(currentUser);
}

function handleInitFailure(error: unknown): void {
  initPromise = null; // let the next consent change retry
  console.warn("[analytics.init] SDK load failed", error);
}

/** Flip every initialized SDK into (or out of) opt-out mode. */
function applyOptOut(optOut: boolean): void {
  try {
    amplitude?.setOptOut(optOut);
    if (optOut) posthog?.opt_out_capturing();
    else posthog?.opt_in_capturing();
    if (optOut) mixpanel?.opt_out_tracking();
    else mixpanel?.opt_in_tracking();
  } catch (e) {
    console.warn("[analytics.consent] opt-out toggle failed", e);
  }
}

export function setAnalyticsConsent(consent: boolean): void {
  consentGranted = consent;
  if (consent) void initAnalytics(true);
  if (!initialized) return;
  applyOptOut(!consent);
  // Mixpanel's opt-out wipes its persisted distinct id — re-attach the user on re-grant.
  if (consent && currentUser) applyIdentity(currentUser);
}

export function track(eventName: string, props: EventProps = {}): void {
  if (typeof window === "undefined" || !consentGranted) return;
  try {
    if (posthog && process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog.capture(eventName, props);
    if (mixpanel && process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) mixpanel.track(eventName, props);
    // Amplitude autocaptures page views (incl. SPA route changes) — sending the
    // synthetic `$pageview` too would double-count them.
    if (amplitude && eventName !== PAGEVIEW_EVENT) amplitude.track(eventName, props);
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, props);
    }
    pushToDataLayer({ event: eventName, ...props });
  } catch (e) {
    console.warn(`[analytics.track] ${eventName} failed`, e);
  }
}

export function pageView(path: string): void {
  track(PAGEVIEW_EVENT, { $current_url: path });
}

function applyIdentity(user: AnalyticsUser): void {
  try {
    if (amplitude) {
      amplitude.setUserId(user.userId);
      const identify = new amplitude.Identify();
      if (user.email) identify.set("email", user.email);
      if (user.isAdmin !== undefined) identify.set("is_admin", user.isAdmin);
      amplitude.identify(identify);
    }
    posthog?.identify(user.userId, user.email ? { email: user.email } : undefined);
    mixpanel?.identify(user.userId);
    if (mixpanel && user.email) mixpanel.people.set({ $email: user.email });
  } catch (e) {
    console.warn("[analytics.identify] failed", e);
  }
}

/**
 * Attach the verified Supabase user to the anonymous device. Call only after
 * authentication (never on form submit) — Amplitude merges the anonymous
 * device history into the user automatically. Safe to call before consent:
 * the identity is held and applied once the SDKs initialize.
 */
export function identifyUser(user: AnalyticsUser): void {
  if (typeof window === "undefined") return;
  currentUser = user;
  if (initialized && consentGranted) applyIdentity(user);
}

/**
 * Detach the user (logout, expired/revoked session) so the next visitor on
 * this device starts anonymous. Only providers that still carry a user id are
 * reset, so on an anonymous device this is a no-op and the anonymous device id
 * — and with it the pre-login → post-login merge — survives. Idempotent; if the
 * SDKs have not loaded yet the reset is applied once they do.
 */
export function resetAnalyticsUser(): void {
  if (typeof window === "undefined") return;
  currentUser = null;
  if (!initialized) {
    resetPending = true;
    return;
  }
  detachIdentity();
}

function detachIdentity(): void {
  resetPending = false;
  try {
    if (amplitude?.getUserId()) amplitude.reset();
    if (posthog?._isIdentified()) posthog.reset();
    if (mixpanel?.get_property(MIXPANEL_USER_ID_PROPERTY)) mixpanel.reset();
  } catch (e) {
    console.warn("[analytics.reset] failed", e);
  }
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
