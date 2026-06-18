# Datadog Vercel Log Drain — setup runbook

Phase 3 observability — captures all `console.*` and Edge / Function runtime
logs from Vercel and ships them to Datadog Logs.

This is **user action only**. No code change; the Vercel ↔ Datadog log drain
is configured in the Vercel dashboard.

## One-time setup (~ 5 min)

1. **Get a Datadog API key.** Datadog UI → Organization Settings → API Keys →
   "Create new API key". Name it `vercel-log-drain`. Copy the key.
2. **Confirm the Datadog site.** US1 = `datadoghq.com`, EU = `datadoghq.eu`,
   US5 = `us5.datadoghq.com`, etc. Match what your Datadog tenant uses.
3. **Add the Log Drain in Vercel.**
   - Vercel dashboard → Project (`dobeu-net`) → Settings → Observability →
     "Add Log Drain".
   - Type: **Datadog**.
   - Datadog API key: paste from step 1.
   - Datadog site: pick from step 2.
   - Sources: leave defaults (Functions, Edge, Build, Static).
   - Environments: enable **Production** + **Preview** (skip Development
     unless you want local-CLI noise).
   - Save.
4. **Confirm.** Trigger any route (e.g. visit `https://dobeu.net/`). Within
   a minute, the corresponding `console.log` should appear in Datadog Logs
   under `service:dobeu-net` (or whatever service tag Vercel attaches).

## Why not in code

Datadog ships a server-side Vercel integration via the Marketplace. That's
the *recommended* path for log capture — there's nothing to add to the app
besides JSON-shaped console output (Vercel auto-parses well-formed JSON
log lines).

## What the app already does

- `lib/datadog.ts` — client-side RUM + Logs (consent-gated, env-guarded; no-ops
  unless `NEXT_PUBLIC_DATADOG_APPLICATION_ID` + `NEXT_PUBLIC_DATADOG_CLIENT_TOKEN`
  are set).
- Webhook handlers (`/api/webhooks/stripe`, `/api/webhooks/calendly`,
  `/api/typeform/webhook`) emit structured JSON on entry + completion
  (`console.log(JSON.stringify({...}))`).
- All `console.error` and `console.warn` get forwarded to Datadog Logs by the
  drain automatically.

## What you do NOT need

- `DD_API_KEY` is **only** for the Datadog server-side SDK if you ever embed
  the agent in code (we don't — the log drain is the server-side path).
- `DD_SERVICE`, `DD_ENV`, `DD_VERSION` — handled per-project by the Log Drain
  config.

## Removal

Vercel dashboard → Project → Settings → Observability → Log Drains → delete.
No app change required.
