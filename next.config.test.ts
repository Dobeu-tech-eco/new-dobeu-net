import { describe, expect, it } from "vitest";

import { buildSecurityHeaders } from "./next.config";

// Baselines captured from the pre-change next.config.ts. Each CSP is the
// directives joined with "; " (split here only to keep lines short).
const SCRIPT_SRC =
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://app.posthog.com " +
  "https://cdn.mxpnl.com https://*.googletagmanager.com https://www.google-analytics.com " +
  "https://js.stripe.com https://embed.typeform.com https://*.apollo.io https://assets.calendly.com " +
  "https://www.datadoghq-browser-agent.com https://va.vercel-scripts.com https://cdn.amplitude.com";
const CONNECT_SRC =
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com " +
  "https://app.posthog.com https://api.mixpanel.com https://api-js.mixpanel.com https://*.mixpanel.com " +
  "https://*.google-analytics.com https://*.analytics.google.com https://api.stripe.com " +
  "https://m.stripe.network https://api.apollo.io https://*.typeform.com https://api.calendly.com " +
  "https://calendly.com https://browser-intake-datadoghq.com https://*.browser-intake-datadoghq.com " +
  "https://browser-intake-us5-datadoghq.com https://*.browser-intake-us5-datadoghq.com " +
  "https://vitals.vercel-insights.com https://vercel.live https://*.amplitude.com";
const REST_DIRECTIVES = [
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://embed.typeform.com " +
    "https://assets.calendly.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.typeform.com " +
    "https://*.apollo.io https://calendly.com https://*.calendly.com",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
];
const COMMON_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" }
];

const cspOf = (extra: string[]) =>
  ["default-src 'self'", SCRIPT_SRC, CONNECT_SRC, ...REST_DIRECTIVES, ...extra].join("; ");

const PRODUCTION_BASELINE = [
  { key: "Content-Security-Policy", value: cspOf(["frame-ancestors 'none'", "upgrade-insecure-requests"]) },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  ...COMMON_HEADERS
];

const DEVELOPMENT_BASELINE = [{ key: "Content-Security-Policy", value: cspOf([]) }, ...COMMON_HEADERS];

const dev = (url?: string) => buildSecurityHeaders({ NODE_ENV: "development", NEXT_PUBLIC_VERCEL_SUPABASE_URL: url });

const connectSrc = (headers: { key: string; value: string }[]) =>
  headers
    .find((h) => h.key === "Content-Security-Policy")!
    .value.split("; ")
    .find((d) => d.startsWith("connect-src "))!;

// With the two local tokens appended, stripping them must give the baseline.
const withoutTokens = (headers: { key: string; value: string }[], tokens: string[]) =>
  headers.map((h) =>
    h.key === "Content-Security-Policy"
      ? { ...h, value: h.value.replace(` ${tokens.join(" ")}`, "") }
      : h
  );

describe("buildSecurityHeaders", () => {
  it("leaves production byte-identical to the baseline", () => {
    expect(
      buildSecurityHeaders({ NODE_ENV: "production", NEXT_PUBLIC_VERCEL_SUPABASE_URL: "http://127.0.0.1:54321" })
    ).toEqual(PRODUCTION_BASELINE);
    expect(
      buildSecurityHeaders({ NODE_ENV: "production", NEXT_PUBLIC_VERCEL_SUPABASE_URL: "https://abc.supabase.co" })
    ).toEqual(PRODUCTION_BASELINE);
    expect(buildSecurityHeaders({ NODE_ENV: "production" })).toEqual(PRODUCTION_BASELINE);
  });

  it.each([undefined, "https://abc.supabase.co", "http://evil.example:54321", "ftp://127.0.0.1", "not a url"])(
    "leaves development unchanged for %s",
    (url) => {
      expect(dev(url)).toEqual(DEVELOPMENT_BASELINE);
    }
  );

  it.each([
    ["http://127.0.0.1:54321", ["http://127.0.0.1:54321", "ws://127.0.0.1:54321"]],
    ["http://localhost:54321", ["http://localhost:54321", "ws://localhost:54321"]],
    ["http://localhost", ["http://localhost", "ws://localhost"]],
    ["http://[::1]:54321", ["http://[::1]:54321", "ws://[::1]:54321"]],
    ["https://localhost:8443", ["https://localhost:8443", "wss://localhost:8443"]],
    ["http://127.0.0.1:54321/rest/v1", ["http://127.0.0.1:54321", "ws://127.0.0.1:54321"]]
  ])("adds local sources to dev connect-src for %s", (url, tokens) => {
    const headers = dev(url);
    const directive = connectSrc(headers).split(" ");
    for (const token of tokens) expect(directive).toContain(token);
    expect(directive.slice(-2)).toEqual(tokens);
    expect(withoutTokens(headers, tokens)).toEqual(DEVELOPMENT_BASELINE);
  });

  it("falls back to VERCEL_SUPABASE_URL when the public one is unset", () => {
    const tokens = ["http://127.0.0.1:54321", "ws://127.0.0.1:54321"];
    const headers = buildSecurityHeaders({ NODE_ENV: "development", VERCEL_SUPABASE_URL: "http://127.0.0.1:54321" });
    expect(withoutTokens(headers, tokens)).toEqual(DEVELOPMENT_BASELINE);
    expect(connectSrc(headers).split(" ").slice(-2)).toEqual(tokens);
  });

  it("prefers NEXT_PUBLIC_VERCEL_SUPABASE_URL when both are set", () => {
    const tokens = ["http://localhost:54321", "ws://localhost:54321"];
    const headers = buildSecurityHeaders({
      NODE_ENV: "development",
      NEXT_PUBLIC_VERCEL_SUPABASE_URL: "http://localhost:54321",
      VERCEL_SUPABASE_URL: "http://127.0.0.1:1111"
    });
    expect(withoutTokens(headers, tokens)).toEqual(DEVELOPMENT_BASELINE);
    expect(connectSrc(headers)).not.toContain("1111");
  });

  it("leaves the test environment unchanged even with a local URL", () => {
    expect(
      buildSecurityHeaders({ NODE_ENV: "test", NEXT_PUBLIC_VERCEL_SUPABASE_URL: "http://127.0.0.1:54321" })
    ).toEqual(DEVELOPMENT_BASELINE);
  });
});
