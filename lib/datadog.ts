"use client";

/**
 * Datadog RUM + Logs client init.
 *
 * Best practice for Next.js + Vercel:
 *   - Client-side: this file (RUM + Logs SDKs, consent-gated, fires after the
 *     user accepts the cookie banner).
 *   - Server-side: install the official Datadog integration in the Vercel
 *     Marketplace (vercel.com/integrations/datadog). It forwards Vercel
 *     Functions / Edge runtime logs to Datadog via a Log Drain — zero code
 *     required in this repo.
 *
 * Setup once in the Datadog UI:
 *   1. UX Monitoring → Applications → New Application → "Browser"
 *   2. Name: "dobeu.net". Type: React.
 *   3. Copy `applicationId` and `clientToken` into Vercel env vars:
 *        NEXT_PUBLIC_DATADOG_APPLICATION_ID
 *        NEXT_PUBLIC_DATADOG_CLIENT_TOKEN
 *        NEXT_PUBLIC_DATADOG_SITE          (e.g. "datadoghq.com" or "us5.datadoghq.com")
 *        NEXT_PUBLIC_DATADOG_SERVICE       (default "dobeu-net")
 *        NEXT_PUBLIC_DATADOG_ENV           ("production" / "preview" / "development")
 *   4. Re-deploy. Sessions, errors, performance, and logs flow automatically.
 *
 * Source-map upload (post-launch hardening) is documented at
 * docs/datadog-sourcemaps.md.
 */

// Browser-only SDKs — loaded lazily via dynamic import() so they are never
// evaluated during SSR/prerender (they reference `window` at module scope,
// which would crash the build with "window is not defined").
type DatadogRum = typeof import("@datadog/browser-rum")["datadogRum"];
type DatadogLogs = typeof import("@datadog/browser-logs")["datadogLogs"];
let datadogRum: DatadogRum | null = null;
let datadogLogs: DatadogLogs | null = null;

let initialized = false;

interface DDConfig {
  applicationId: string;
  clientToken: string;
  site: string;
  service: string;
  env: string;
  version?: string;
}

function readEnv(): DDConfig | null {
  const applicationId = process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID;
  const clientToken = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN;
  if (!applicationId || !clientToken) return null;
  return {
    applicationId,
    clientToken,
    site: process.env.NEXT_PUBLIC_DATADOG_SITE || "datadoghq.com",
    service: process.env.NEXT_PUBLIC_DATADOG_SERVICE || "dobeu-net",
    env:
      process.env.NEXT_PUBLIC_DATADOG_ENV ||
      process.env.NODE_ENV ||
      "development",
    version: process.env.NEXT_PUBLIC_DATADOG_VERSION || undefined,
  };
}

export function isDatadogConfigured(): boolean {
  return readEnv() !== null;
}

/**
 * Initialize Datadog RUM + Logs SDKs. Idempotent. Skips silently if not configured.
 * Should be called once at app boot AFTER user consent.
 */
export async function initDatadog(): Promise<void> {
  if (typeof window === "undefined" || initialized) return;
  const config = readEnv();
  if (!config) return;

  const [rumMod, logsMod] = await Promise.all([
    import("@datadog/browser-rum"),
    import("@datadog/browser-logs")
  ]);
  datadogRum = rumMod.datadogRum;
  datadogLogs = logsMod.datadogLogs;

  // RUM — sessions, performance, errors, user actions
  datadogRum.init({
    applicationId: config.applicationId,
    clientToken: config.clientToken,
    site: config.site as "datadoghq.com",
    service: config.service,
    env: config.env,
    version: config.version,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "mask-user-input",
    // Don't surface third-party errors in our dashboards
    allowedTracingUrls: [(url) => url.startsWith(window.location.origin)],
    // Hide RUM noise from browser extensions
    silentMultipleInit: true,
  });

  // Logs — structured client-side logs that ship to Datadog
  datadogLogs.init({
    clientToken: config.clientToken,
    site: config.site as "datadoghq.com",
    service: config.service,
    env: config.env,
    version: config.version,
    forwardErrorsToLogs: true,
    forwardConsoleLogs: ["error", "warn"],
    sessionSampleRate: 100,
    silentMultipleInit: true,
  });

  initialized = true;
}

/**
 * Attach the current user (e.g., post-login) so events are user-correlated.
 */
export function ddIdentify(user: {
  id: string;
  email?: string;
  name?: string;
}): void {
  if (!initialized || !datadogRum || !datadogLogs) return;
  datadogRum.setUser({ id: user.id, email: user.email, name: user.name });
  datadogLogs.setUser({ id: user.id, email: user.email, name: user.name });
}

/**
 * Manual custom action / event. Use for high-signal events the UI wouldn't
 * autocapture (e.g., "booking_scheduled" after Calendly returns success).
 */
export function ddAction(
  name: string,
  context: Record<string, unknown> = {},
): void {
  if (!initialized || !datadogRum) return;
  datadogRum.addAction(name, context);
}

/**
 * Manual error. Use in catch blocks where you want to attach extra metadata.
 */
export function ddError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  if (!initialized || !datadogRum) return;
  const err = error instanceof Error ? error : new Error(String(error));
  datadogRum.addError(err, context);
}
