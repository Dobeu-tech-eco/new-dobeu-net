/**
 * Shared URL redaction for Datadog RUM (browser) and HTTP log intake (server).
 * Keep this module free of `"use client"` / `server-only` so both sides can import it.
 */

/** Query-string keys that must never reach Datadog. */
export const SENSITIVE_QUERY_KEYS = [
  "email",
  "token",
  "access_token",
  "refresh_token",
  "code",
  "session",
  "signature",
  "api_key",
  "apikey",
  "password"
] as const;

/**
 * Strip sensitive query parameters from any URL (absolute or path-only)
 * before it is sent to Datadog. Relative paths such as `/auth/callback?code=`
 * stay relative so server `request.path` logs keep their original shape.
 */
export function redactUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url, "https://dobeu.net");
    let touched = false;
    for (const key of SENSITIVE_QUERY_KEYS) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, "REDACTED");
        touched = true;
      }
    }
    if (!touched) return url;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Redact `http.url` on a log context object. Leaves other fields untouched. */
export function redactLogContext(context: Record<string, unknown>): Record<string, unknown> {
  const http = context.http;
  if (!http || typeof http !== "object" || !("url" in http)) return context;
  const url = (http as { url: unknown }).url;
  if (typeof url !== "string") return context;
  return {
    ...context,
    http: { ...(http as Record<string, unknown>), url: redactUrl(url) ?? url }
  };
}
