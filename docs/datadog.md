# Datadog observability — dobeu.net

Single pane of glass for the marketing site, the client portal and the admin
surface. Datadog replaced Sentry in August 2026: RUM covers browser errors and
session replay, Logs covers browser + server logs, and Synthetics covers uptime.

**Org:** Dobeu Tech Solutions LLC · **Site:** `datadoghq.com` (US1) · **Plan:**
Datadog for Startups (since 2026-03-09).

**RUM application:** `Dobeu.net` — `applicationId 7964b0ba-f8e4-4d6a-8fca-677e2510b0f5`.

---

## What is instrumented

| Layer | Mechanism | Source |
| --- | --- | --- |
| Browser sessions, Core Web Vitals, resources, long tasks | RUM Browser SDK v7 | `lib/datadog.ts` |
| Browser errors + console warn/error + CSP violation reports | Logs Browser SDK v7 | `lib/datadog.ts` |
| Session Replay | RUM (20% of production sessions) | `lib/datadog.ts` |
| Server errors (Route Handlers, Server Actions, RSC) | `onRequestError` → HTTP log intake | `instrumentation.ts`, `lib/datadog-server.ts` |
| Platform logs (every function invocation, build, edge) | Datadog integration in the Vercel Marketplace (Log Drain) | Vercel dashboard |
| Uptime / SSL | Synthetic API + browser tests | Datadog UI |

## Consent

Everything is gated behind the **analytics** cookie category. `AnalyticsProvider`
calls `setDatadogConsent(consent.analytics)`:

- **Granted** → the SDKs are dynamically imported (so visitors who decline never
  download ~100 KB of JS), initialised, and consent set to `granted`.
- **Withdrawn** → `setTrackingConsent("not-granted")` stops collection and clears
  the Datadog session cookie. If the SDK never loaded, nothing happens.

## Environment variables

Client-exposed (safe to publish — the RUM client token is public by design):

```
NEXT_PUBLIC_DATADOG_APPLICATION_ID
NEXT_PUBLIC_DATADOG_CLIENT_TOKEN
NEXT_PUBLIC_DATADOG_SITE                 datadoghq.com
NEXT_PUBLIC_DATADOG_SERVICE              dobeu-net
NEXT_PUBLIC_DATADOG_ENV                  optional, falls back to NEXT_PUBLIC_VERCEL_ENV
NEXT_PUBLIC_DATADOG_VERSION              optional, falls back to the short commit SHA
NEXT_PUBLIC_DATADOG_REPLAY_SAMPLE_RATE   optional, default 20 in prod / 0 elsewhere
NEXT_PUBLIC_DATADOG_TRACE_SAMPLE_RATE    optional, default 20
```

Server-only (**sensitive**):

```
DATADOG_API_KEY   server error logs + source-map upload
DATADOG_SITE      datadoghq.com
```

`NEXT_PUBLIC_VERCEL_ENV` and `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` require
"Automatically expose System Environment Variables" to be enabled on the Vercel
project — it is what gives every RUM event its `env` and `version` tag.

## Privacy and noise control

- `defaultPrivacyLevel: "mask-user-input"` — every input is masked in replay.
- `enablePrivacyForActionName: true` — action names are never derived from
  user-authored text.
- `beforeSend` redacts `email`, `token`, `code`, `session`, `signature`,
  `api_key`, `password` and friends from view / resource / error URLs.
- `beforeSend` drops un-actionable noise: `ResizeObserver loop`, bare
  `Script error.`, and anything originating in a browser extension.
- `allowedTracingUrls` injects trace headers **only** on our own origin, so no
  trace ids leak to Stripe, Calendly, Intercom or Supabase.
- `allowedTrackingOrigins` prevents extension-injected RUM from reporting.

## CSP

`next.config.ts` already allows the Datadog intake in `connect-src`
(`browser-intake-datadoghq.com` and the `us5` variants) and `worker-src 'self'
blob:`, which Session Replay's deflate worker needs. **If you change
`NEXT_PUBLIC_DATADOG_SITE`, add the matching intake host to `csp.connect`** or
every event will be blocked with no visible error.

Browser CSP violations are forwarded to Datadog Logs (`forwardReports` includes
`csp_violation`), so a CSP regression shows up as a log, not as silence.

## Sampling and cost

The Startup plan is generous but not infinite. Current posture:

- `sessionSampleRate: 100` — every session is a RUM session.
- `sessionReplaySampleRate: 20` in production, `0` in preview/dev. Replay is the
  expensive product; raise deliberately.
- `telemetrySampleRate: 20` — SDK self-telemetry.
- `traceSampleRate: 20`.

All are env-overridable without a code change.

## Runbook

- **No RUM data at all** → check `NEXT_PUBLIC_DATADOG_APPLICATION_ID` and
  `NEXT_PUBLIC_DATADOG_CLIENT_TOKEN` are set for the target environment in
  Vercel, then confirm the analytics cookie category is accepted. The SDK is
  intentionally silent when unconfigured.
- **Data arrives but stack traces are minified** → see
  [datadog-sourcemaps.md](./datadog-sourcemaps.md); the `version` tag and the
  uploaded map's `release-version` must match exactly.
- **Events blocked in the browser console** → CSP. Add the intake host.
- **Server errors missing** → `DATADOG_API_KEY` unset, or the error was caught
  by application code and never reached `onRequestError`; use
  `logServerError()` explicitly in that case.
