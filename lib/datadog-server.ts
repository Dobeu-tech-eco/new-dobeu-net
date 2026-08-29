/**
 * Server-side Datadog logging for Next.js Route Handlers, Server Actions and
 * the App Router error hook.
 *
 * Vercel's Functions runtime cannot host the Datadog Agent, so this ships
 * structured logs straight to the Datadog HTTP log intake. It is deliberately
 * dependency-free and always non-fatal: a Datadog outage must never surface as
 * a 500 on dobeu.net.
 *
 * Bulk platform logs (every request, build output, edge logs) are better served
 * by the Datadog integration in the Vercel Marketplace, which installs a Log
 * Drain. This module covers the high-signal application errors you want
 * structured attributes on. See docs/datadog.md.
 *
 * Server-only env vars:
 *   DATADOG_API_KEY   Datadog API key (NOT the RUM client token). Sensitive.
 *   DATADOG_SITE      default "datadoghq.com"
 */

import "server-only";

const DEFAULT_SITE = "datadoghq.com";

type LogLevel = "debug" | "info" | "warn" | "error";

function intakeUrl(): string | null {
  const apiKey = process.env.DATADOG_API_KEY;
  if (!apiKey) return null;
  const site = process.env.DATADOG_SITE || DEFAULT_SITE;
  return `https://http-intake.logs.${site}/api/v2/logs`;
}

export function isDatadogServerConfigured(): boolean {
  return intakeUrl() !== null;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      kind: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return { kind: "UnknownError", message: String(error) };
}

/**
 * Ship one structured log line to Datadog. Never throws and never rejects —
 * callers can fire-and-forget.
 */
export async function logToDatadog(
  level: LogLevel,
  message: string,
  attributes: Record<string, unknown> = {}
): Promise<void> {
  const url = intakeUrl();
  const apiKey = process.env.DATADOG_API_KEY;
  if (!url || !apiKey) return;

  const body = {
    ddsource: "nextjs",
    ddtags: [
      `env:${process.env.VERCEL_ENV || process.env.NODE_ENV || "development"}`,
      `version:${(process.env.VERCEL_GIT_COMMIT_SHA || "unknown").slice(0, 7)}`,
      `region:${process.env.VERCEL_REGION || "unknown"}`
    ].join(","),
    service: process.env.NEXT_PUBLIC_DATADOG_SERVICE || "dobeu-net",
    hostname: process.env.VERCEL_URL || "localhost",
    status: level,
    message,
    ...attributes
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": apiKey
      },
      body: JSON.stringify(body),
      // Never let observability hold a response open.
      signal: AbortSignal.timeout(2000),
      cache: "no-store"
    });
  } catch {
    // Swallow: logging must never break the request.
  }
}

/** Convenience wrapper for caught server errors. */
export async function logServerError(
  error: unknown,
  context: Record<string, unknown> = {}
): Promise<void> {
  const err = serializeError(error);
  await logToDatadog("error", String(err.message), { error: err, ...context });
}
