"use client";

/**
 * Datadog RUM + Logs client init for dobeu.net.
 *
 * Architecture
 * ------------
 * - Client-side (this file): RUM + Logs browser SDKs, lazily imported so the
 *   ~100 KB of SDK JavaScript is never downloaded for visitors who decline
 *   analytics cookies. Initialised from `AnalyticsProvider` once the user
 *   accepts the analytics category.
 * - Server-side: the Datadog integration in the Vercel Marketplace forwards
 *   Functions / Edge logs via a Log Drain. No code in this repo is required.
 *   See docs/datadog.md.
 *
 * Environment variables (all client-exposed, hence NEXT_PUBLIC_):
 *   NEXT_PUBLIC_DATADOG_APPLICATION_ID   RUM application id
 *   NEXT_PUBLIC_DATADOG_CLIENT_TOKEN     RUM client token (public by design)
 *   NEXT_PUBLIC_DATADOG_SITE             default "datadoghq.com" (US1)
 *   NEXT_PUBLIC_DATADOG_SERVICE          default "dobeu-net"
 *   NEXT_PUBLIC_DATADOG_ENV              falls back to NEXT_PUBLIC_VERCEL_ENV
 *   NEXT_PUBLIC_DATADOG_VERSION          falls back to the Vercel commit SHA
 *   NEXT_PUBLIC_DATADOG_REPLAY_SAMPLE_RATE   0-100, default 20 in production
 *   NEXT_PUBLIC_DATADOG_TRACE_SAMPLE_RATE    0-100, default 20
 *
 * `version` MUST match the version used when uploading source maps, or RUM
 * stack traces stay minified. See docs/datadog-sourcemaps.md.
 */

import type { RumEvent, RumInitConfiguration } from "@datadog/browser-rum";
import { redactUrl } from "@/lib/datadog-redact";

export { redactUrl } from "@/lib/datadog-redact";

// Browser-only SDKs — loaded lazily via dynamic import() so they are never
// evaluated during SSR/prerender (they reference `window` at module scope,
// which would crash the build with "window is not defined").
type DatadogRum = (typeof import("@datadog/browser-rum"))["datadogRum"];
type DatadogLogs = (typeof import("@datadog/browser-logs"))["datadogLogs"];

let datadogRum: DatadogRum | null = null;
let datadogLogs: DatadogLogs | null = null;

let initialized = false;
let initPromise: Promise<void> | null = null;
/** Latest consent choice. Used to abort an in-flight init if the user withdraws. */
let latestConsent: boolean | null = null;

interface DDConfig {
  applicationId: string;
  clientToken: string;
  site: string;
  service: string;
  env: string;
  version?: string;
  replaySampleRate: number;
  traceSampleRate: number;
}

/**
 * Error messages that are pure noise: browser extensions, cross-origin script
 * errors we cannot action, and the benign ResizeObserver loop warning.
 */
const IGNORED_ERROR_PATTERNS = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /Non-Error promise rejection captured/i
];

function readNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return fallback;
  return parsed;
}

function readEnv(): DDConfig | null {
  const applicationId = process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID;
  const clientToken = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN;
  if (!applicationId || !clientToken) return null;

  const env =
    process.env.NEXT_PUBLIC_DATADOG_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development";

  const explicitVersion = process.env.NEXT_PUBLIC_DATADOG_VERSION;
  const sha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || undefined;
  // Explicit overrides must match scripts/upload-sourcemaps.mjs verbatim.
  // Only derived commit SHAs are shortened to 7 chars.
  const version = explicitVersion || (sha ? sha.slice(0, 7) : undefined);

  return {
    applicationId,
    clientToken,
    site: process.env.NEXT_PUBLIC_DATADOG_SITE || "datadoghq.com",
    service: process.env.NEXT_PUBLIC_DATADOG_SERVICE || "dobeu-net",
    env,
    version,
    replaySampleRate: readNumber(
      process.env.NEXT_PUBLIC_DATADOG_REPLAY_SAMPLE_RATE,
      env === "production" ? 20 : 0
    ),
    traceSampleRate: readNumber(process.env.NEXT_PUBLIC_DATADOG_TRACE_SAMPLE_RATE, 20)
  };
}

export function isDatadogConfigured(): boolean {
  return readEnv() !== null;
}

export function isIgnoredError(message: string | undefined): boolean {
  if (!message) return false;
  return IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * beforeSend: redact URLs and drop un-actionable third-party noise.
 * Returning false discards the event entirely.
 */
const beforeSend: NonNullable<RumInitConfiguration["beforeSend"]> = (event) => {
  const rumEvent = event as RumEvent;

  if (rumEvent.type === "error" && isIgnoredError(rumEvent.error?.message)) {
    return false;
  }

  if (rumEvent.view?.url) {
    rumEvent.view.url = redactUrl(rumEvent.view.url) as string;
  }
  if (rumEvent.view?.referrer) {
    rumEvent.view.referrer = redactUrl(rumEvent.view.referrer) as string;
  }
  if (rumEvent.type === "resource" && rumEvent.resource?.url) {
    rumEvent.resource.url = redactUrl(rumEvent.resource.url) as string;
  }
  if (rumEvent.type === "error" && rumEvent.error?.resource?.url) {
    rumEvent.error.resource.url = redactUrl(rumEvent.error.resource.url) as string;
  }

  return true;
};

function applyWithdrawnConsent(): void {
  datadogRum?.setTrackingConsent("not-granted");
  datadogLogs?.setTrackingConsent("not-granted");
  datadogRum?.clearUser();
  datadogLogs?.clearUser();
}

/**
 * Initialize Datadog RUM + Logs SDKs. Idempotent and concurrency-safe.
 * Skips silently when the environment is not configured.
 * Must only be called AFTER the user has granted analytics consent.
 */
export async function initDatadog(): Promise<void> {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (initPromise) return initPromise;

  const config = readEnv();
  if (!config) return;

  initPromise = (async () => {
    const [rumMod, logsMod] = await Promise.all([
      import("@datadog/browser-rum"),
      import("@datadog/browser-logs")
    ]);
    // Consent can flip to withdrawn while the SDKs are still downloading.
    if (latestConsent === false) return;

    datadogRum = rumMod.datadogRum;
    datadogLogs = logsMod.datadogLogs;

    const sameOrigin = (url: string) => url.startsWith(window.location.origin);

    // RUM — sessions, Core Web Vitals, resources, errors, user actions.
    datadogRum.init({
      applicationId: config.applicationId,
      clientToken: config.clientToken,
      site: config.site as RumInitConfiguration["site"],
      service: config.service,
      env: config.env,
      version: config.version,

      sessionSampleRate: 100,
      sessionReplaySampleRate: config.replaySampleRate,
      telemetrySampleRate: 20,

      trackUserInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      // Captures cache-control / x-vercel-cache etc. so CDN HIT/MISS is visible
      // on every resource in RUM.
      trackResourceHeaders: true,

      // Privacy: mask every input by default and never derive action names from
      // user-authored text.
      defaultPrivacyLevel: "mask-user-input",
      enablePrivacyForActionName: true,

      // Distributed tracing: inject headers only on our own origin so we never
      // leak trace ids to Stripe / Calendly / Intercom / Supabase.
      allowedTracingUrls: [
        { match: sameOrigin, propagatorTypes: ["tracecontext", "datadog"] }
      ],
      traceSampleRate: config.traceSampleRate,

      // Ignore RUM initialised by browser extensions on other origins.
      allowedTrackingOrigins: [window.location.origin],

      beforeSend,
      silentMultipleInit: true
      // trackResourceHeaders is a documented Browser RUM v7 option (CDN HIT/MISS
      // via x-vercel-cache) that @datadog/browser-rum 7.10.0's types omit.
    } as RumInitConfiguration & { trackResourceHeaders: boolean });

    // Logs — structured browser logs, forwarded errors, and CSP violation
    // reports (valuable given the strict CSP in next.config.ts).
    datadogLogs.init({
      clientToken: config.clientToken,
      site: config.site as RumInitConfiguration["site"],
      service: config.service,
      env: config.env,
      version: config.version,
      forwardErrorsToLogs: true,
      forwardConsoleLogs: ["error", "warn"],
      forwardReports: ["intervention", "deprecation", "csp_violation"],
      sessionSampleRate: 100,
      telemetrySampleRate: 20,
      silentMultipleInit: true
    });

    initialized = true;
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

/**
 * Single entry point for the cookie banner. Grants or withdraws tracking
 * consent. Withdrawing stops collection and clears the Datadog session cookie.
 */
export async function setDatadogConsent(granted: boolean): Promise<void> {
  latestConsent = granted;
  if (granted) {
    while (latestConsent === true && !initialized) {
      await initDatadog();
      if (!initialized) break;
    }
    if (latestConsent !== true) {
      applyWithdrawnConsent();
      return;
    }
    datadogRum?.setTrackingConsent("granted");
    datadogLogs?.setTrackingConsent("granted");
    return;
  }
  // Never initialise just to opt out — if the SDK never loaded there is
  // nothing to stop.
  applyWithdrawnConsent();
}

/** Attach the current user (e.g. post-login) so events are user-correlated. */
export function ddIdentify(user: { id: string; email?: string; name?: string }): void {
  if (!initialized || !datadogRum || !datadogLogs) return;
  datadogRum.setUser({ id: user.id, email: user.email, name: user.name });
  datadogLogs.setUser({ id: user.id, email: user.email, name: user.name });
}

/** Clear the user on logout. */
export function ddClearUser(): void {
  if (!initialized) return;
  datadogRum?.clearUser();
  datadogLogs?.clearUser();
}

/** Attributes attached to every subsequent event (plan tier, feature area…). */
export function ddSetGlobalContext(context: Record<string, unknown>): void {
  if (!initialized || !datadogRum) return;
  datadogRum.setGlobalContext(
    context as Parameters<NonNullable<typeof datadogRum>["setGlobalContext"]>[0]
  );
}

/**
 * Manual custom action. Use for high-signal events the UI would not autocapture
 * (e.g. "booking_scheduled" once Calendly confirms).
 */
export function ddAction(name: string, context: Record<string, unknown> = {}): void {
  if (!initialized || !datadogRum) return;
  datadogRum.addAction(name, context);
}

/** Manual error, for catch blocks where extra metadata is worth attaching. */
export function ddError(error: unknown, context: Record<string, unknown> = {}): void {
  if (!initialized || !datadogRum) return;
  const err = error instanceof Error ? error : new Error(String(error));
  datadogRum.addError(err, context);
}

/** Record a feature-flag evaluation so RUM can segment by flag value. */
export function ddFeatureFlag(key: string, value: unknown): void {
  if (!initialized || !datadogRum) return;
  datadogRum.addFeatureFlagEvaluation(key, value);
}

/**
 * Deep link to the session replay for the current session — handy to attach to
 * a support ticket from the Intercom integration.
 */
export function ddSessionReplayLink(): string | undefined {
  if (!initialized || !datadogRum) return undefined;
  return datadogRum.getSessionReplayLink();
}
