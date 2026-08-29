# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`dobeu.net` v3 — Next.js 15 (App Router) marketing landing + minimal client portal for Dobeu Tech Solutions. TypeScript, Tailwind, shadcn/ui, Supabase backend, deployed to Vercel.

`BRAINSTORM.md` and `PLAN.md` are the source of truth for scope, decisions, and verification gates; `STATUS.md` tracks phase progress (Phases 1–5 have shipped on `main`: admin CRUD server actions, Stripe-hosted invoicing + webhook, Resend email templates, `is_admin` column dropped). `AUDIT.md` is a landing-page accessibility/SEO audit from a v0 session. Public pages beyond the landing: `/privacy`, `/terms` (rewritten from `/tos`), `/cookies`, `/marketing-opt-out`, `/optin`, `/repos` (GitHub showcase), `/login`.

Sibling agent-instruction files (`AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`) are **thin pointers only**. Do not duplicate architectural guidance there — update this file instead. They exist solely because Codex / Gemini CLI / Copilot look for those filenames.

## Commands

Package manager is **pnpm** (`packageManager: pnpm@10.34.1`, Node >=20). `pnpm-workspace.yaml` exists only to whitelist `onlyBuiltDependencies` (pnpm 10's allow-builds mechanism) — this is not a multi-package workspace.

```bash
pnpm dev                       # dev server -> http://localhost:3000
pnpm build                     # production build (what Vercel runs)
pnpm build:strict              # scripts/strict-build.mjs — build that FAILS on select Next.js warnings
pnpm type-check                # tsc --noEmit
pnpm lint                      # next lint  (pnpm lint:fix to autofix)
pnpm test                      # vitest (watch)
pnpm test:ci                   # vitest run (one-shot)
pnpm test:e2e                  # playwright   (pnpm test:e2e:ui for UI mode)
pnpm verify                    # type-check && lint && test:ci && build:strict -- run before merging to main
                               # CI (.github/workflows/ci.yml) runs pnpm install --frozen-lockfile + pnpm verify.
pnpm vcr:push-function         # build + push the OCI container image to Vercel Container Registry
                               # (pwsh scripts/push-vcr-function-image.ps1; needs Docker + `vercel vcr login docker`)
```

Supabase (local stack via Docker):

```bash
pnpm supabase start            # local Postgres + Auth
pnpm supabase db push          # apply migrations in supabase/migrations/
pnpm db:types                  # regenerate lib/database.types.ts from local schema
```

## Testing
- **Vitest** — `vitest.config.ts`, tests colocated as `*.test.ts(x)` under `app/`, `lib/`, and `hooks/`. Run a single file: `pnpm test:ci -- lib/leads.test.ts`. Focus by name: `pnpm test:ci -- -t "processLead"`.
- **Playwright** — `playwright.config.ts` + `e2e/*`. Smoke-only today. Run with `pnpm test:e2e` (or `pnpm test:e2e:ui` for UI mode).
- CI runs `pnpm verify` in `.github/workflows/ci.yml` (type-check + lint + test:ci + strict build).

## Build verification

`next.config.ts` sets `typescript.ignoreBuildErrors: false` and `eslint.ignoreDuringBuilds: false` -- **the build is a real verifier**. A green build means the code typechecks and lints.

For a full pre-merge check, run `pnpm verify`, which mirrors CI locally. `pnpm build:strict` additionally fails on the `Detected "engines"` and `currently disables static generation` warnings; plain `pnpm build` (used by Vercel) stays lenient so a harmless future warning can't block production deploys.

### Next config
Only `next.config.ts` is tracked (the shadowing `next.config.js` v0-import was removed; production headers confirmed live 2026-08-29). **Do not add a `next.config.js`** — Next.js resolves it first and it would silently shadow the CSP/security headers, strict-mode flags, redirects, and rewrites in the `.ts` file.

## Architecture

### Three-surface app, one Next.js project
- **`app/` (root)** -- public marketing landing, composed from `components/landing/*` (Hero, Services, FAQ, LeadForm, lightbox-based booking/Typeform tabs), plus the legal/opt-in pages listed above.
- **`app/portal/*`** -- authenticated client area (projects, files, invoices, messages, settings). Requires a logged-in Supabase user.
- **`app/admin/*`** -- admin-only dashboards with CRUD via `lib/actions/*`. **App-layer gated** in `app/admin/layout.tsx` by `isAdminEmail(user.email)` (from `lib/utils.ts`, backed by the `ADMIN_EMAILS` env var). Most admin pages read through `createAdminClient()` (service role), so **RLS is not the active enforcement layer for admin reads today** — the `ADMIN_EMAILS` check is.

### Second Vercel service: OCI container function (`containers/function/`)
`vercel.json` is a **multi-service** config, not just build settings. It declares two services: `web` (the Next.js app, root `.`) and `oci` (a `runtime: container` service, root `containers/function`, built from a `Dockerfile`). The two are deployed together but are separate runtimes — the OCI function is **not** a Next.js route.

- **What it is** — a minimal `node:20-alpine` HTTP server (`server.mjs`, `node:http`) that listens on `$PORT` (default 80 per Vercel's container runtime), handles `SIGTERM`/`SIGINT` for graceful scale-in, and today just answers `GET /`, `/health`, `/healthz` with JSON. It's a scaffold/proof-of-concept for running arbitrary containerized workloads next to the marketing app, not yet a product surface.
- **Public prefix `/oci`** — reached at `/oci` and `/oci/*`. Routing is layered: `vercel.json` `rewrites` send `/oci`(`/*`) to the `oci` service (everything else falls through to `web`); the service's own `routes` strip the `/oci` prefix via `request.path` transforms. `server.mjs` still defensively re-strips it via `toServicePath()` in `path.mjs` (unit-tested in `path.test.ts`), because the container may see either the stripped or original path depending on the routing layer. Keep that helper and its test in sync if you add handlers.
- **`middleware.ts` excludes `/oci`** — the matcher explicitly skips `oci(?:/|$)` so the Next.js Supabase session middleware never runs for the container service. Any new top-level path that should bypass Next.js must be added there too.
- **Deploying the image** — the app deploy does not build the container from source on Vercel; you push a prebuilt image to Vercel Container Registry with `pnpm vcr:push-function` (→ `scripts/push-vcr-function-image.ps1`, target `vcr.vercel.com/dobeutechnology/new-dobeu-net/new-dobeu-net-oci`). Requires Docker Desktop, `vercel link`, and `vercel vcr login docker`. Builds `linux/amd64` by default (`-Platforms` for multi-arch). Local smoke test: `docker run --rm -p 8080:80 <image>` then `curl localhost:8080/health`.

### Supabase access pattern (three clients -- pick deliberately)
- `lib/supabase/client.ts` -- browser client.
- `lib/supabase/server.ts` -> `createClient()` -- request-cookie-bound client for Server Components / Route Handlers / Server Actions; respects RLS as the logged-in user.
- `lib/supabase/server.ts` -> `createAdminClient()` -- **service-role, bypasses RLS, server-only**. Use only for admin ops and webhooks (e.g. the lead API). Throws if `VERCEL_SUPABASE_SERVICE_ROLE_KEY` is missing.
- `lib/supabase/middleware.ts` + root `middleware.ts` -- refreshes the auth session on every request (matcher excludes static assets).

All `/admin/*` and `/api/lead` use `export const dynamic = "force-dynamic"` because they read per-request auth/cookies and must never be statically pre-rendered.

### Database & RLS
Migrations in `supabase/migrations/` are ordered and additive — the initial schema (`20260521...`) defines `profiles`, `projects`, `project_files`, `invoices`, `messages`, `leads`, `bookings`, `page_events`; later migrations add work-order/invoice linkage, `profiles.stripe_customer_id`, `profiles.phone` + notification prefs, and a live-schema repair. **RLS is enabled on every table** — users see only their own rows; admin reads use `createAdminClient()` (service role). The `profiles.is_admin` column was dropped in `20260616000000_phase5_drop_is_admin.sql`; `ADMIN_EMAILS` is the sole admin gate. A `handle_new_user` trigger auto-creates a `profiles` row on signup. `lib/database.types.ts` is generated, not hand-edited — regenerate with `pnpm db:types`.

### Lead pipeline (`lib/leads.ts` -> `processLead()`)
The fan-out lives in `lib/leads.ts` so every lead entry point shares one code path. Each step is best-effort / non-fatal so one failure never drops the lead: (1) insert into Supabase `leads` via admin client -> (2) upsert Apollo contact (`lib/apollo.ts`) -> (3) write Apollo id back -> (4) Customer.io identify + `lead_captured` event (`lib/customerio.ts`) -> (5) Resend confirmation to lead + notification to admin.

Entry points that call `processLead()`:
- **`app/api/lead/route.ts`** -- public `POST` (the landing-page form). Zod-validated, per-IP rate limit: Upstash sliding window (`@upstash/ratelimit`) when `UPSTASH_REDIS_REST_URL/TOKEN` are set, in-memory fallback otherwise.
- **`app/api/webhooks/calendly/route.ts`** -- Calendly `invitee.created` webhook. Verifies the `Calendly-Webhook-Signature` HMAC (`lib/calendly.ts`) before trusting the payload; gated on `CALENDLY_WEBHOOK_SIGNING_KEY` (returns 503 / never accepts unsigned calls when unset). This is where a booking actually becomes a lead -- the client-side Calendly embed only exposes URIs, not email/name.
- **`app/api/typeform/webhook/route.ts`** -- Typeform submissions, HMAC-verified via `TYPEFORM_WEBHOOK_SECRET`.

### Stripe invoicing (Phase 3 — live)
- `lib/invoice-creation.ts` — service-role invoice creation core. Deliberately **not** a `"use server"` file so its exports can't be invoked from the client; callers do their own authz (`createInvoice` after `requireAdmin()`, `acceptWorkOrderQuote` after owner check). Locked decisions: Stripe-hosted invoices; lazy-create the Stripe customer on first invoice and stash on `profiles.stripe_customer_id`; mirror Stripe state onto a local `invoices` row; a Stripe failure still inserts a local row (NULL `stripe_invoice_id`) so the admin sees the attempt.
- `app/api/webhooks/stripe/route.ts` — signed webhook (`STRIPE_WEBHOOK_SECRET`) drives all local invoice status flips (`invoice.paid/payment_failed/finalized/voided`); the UI never optimistically marks paid. Dedupes per `event.id` via `lib/stripe-event-dedupe.ts` (in-memory LRU) and idempotent UPDATEs. Must stay `runtime = "nodejs"` (Stripe SDK doesn't run on edge). Unhandled events are acked 200 so Stripe stops retrying.
- `markInvoicePaidManually` (in `lib/actions/invoices.ts`) is the only escape hatch, for cash/wire/check.

### Embedded agent surface (`lib/agent/`)
`lib/agent/index.ts` runs the Claude Agent SDK's `query()` against a per-user Composio tool-router session. Degrades gracefully: returns `{ ok: false, error: "not_configured" | "sdk_not_installed" }` when `COMPOSIO_API_KEY`/`ANTHROPIC_API_KEY` or the SDK packages are absent — never throws at build time. HTTP surface is `app/api/agent/route.ts` (**admin-gated** via `isAdminEmail`, `maxDuration = 60`); long-running automations belong in `scripts/agent.ts` out of band. Never accept `permissionMode: "bypassPermissions"` from an end-user request body.

### Client-side analytics fan-out (`lib/analytics.ts`)
`"use client"` module. One `track()` call dispatches to PostHog + Mixpanel + Amplitude + GA4 (gtag) + GTM dataLayer (GA4/GTM scripts load via `<Script>` in `app/layout.tsx`; posthog-js / mixpanel-browser / `@amplitude/unified` load lazily). **Consent-gated**: `initAnalytics(consent)` no-ops until the user consents (cookie-consent banner; `hooks/use-cookie-consent.ts`); withdrawing consent calls each SDK's opt-out so autocaptured events stop too. Each provider is independently feature-flagged by the presence of its `NEXT_PUBLIC_*` env key. Datadog RUM/Logs (`lib/datadog.ts`) and Intercom (`lib/intercom.ts`) wire in via `components/analytics-provider.tsx` / `app/layout.tsx`.

**Amplitude specifics** (org `polished-sun-911894`, project `dobeu.net` #784238, US zone): `@amplitude/unified` with explicit Autocapture (page views, sessions, forms, clicks, downloads, attribution, web vitals, frustration signals; network tracking off), Session Replay at `NEXT_PUBLIC_AMPLITUDE_REPLAY_SAMPLE_RATE` (default 1; remote setting wins), Guides & Surveys skipped. `track()` deliberately does **not** forward the synthetic `$pageview` to Amplitude — autocapture already records route changes. Identity: `components/portal/AnalyticsIdentify.tsx` (mounted in the portal/admin layouts) calls `identifyUser()` with the Supabase user id + email; `LogoutButton` calls `resetAnalyticsUser()`. Event names stay `snake_case` in code (shared with GA4/PostHog/Mixpanel); Title Case display names + descriptions live in Amplitude's tracking plan — see `docs/tracking-plan.md`.

### Security headers / CSP
`next.config.ts` builds a strict Content-Security-Policy plus HSTS, X-Frame-Options, etc., applied to all routes. When adding any third-party script, embed, or API host, add its domains to the relevant CSP array (`script`, `connect`, `frame`, `font`, `style`) or it will be blocked at runtime (Amplitude needs `https://*.amplitude.com` in `connect` and `worker-src blob:` for replay compression). CSP arrays are intentionally split line-per-entry so git keeps treating the file as text.

### `lib/` map
- `lib/supabase/{client,server,middleware}.ts` — the three clients described above.
- `lib/leads.ts` — `processLead()` fan-out (single shared path).
- `lib/apollo.ts`, `lib/customerio.ts`, `lib/calendly.ts`, `lib/typeform.ts` — third-party integrations called from the lead pipeline / webhooks.
- `lib/stripe.ts`, `lib/stripe-event-dedupe.ts`, `lib/invoice-creation.ts` — Stripe surfaces (see above).
- `lib/resend.ts` + `lib/resend-templates.ts` — email send wrapper + HTML templates; every send is wrapped so a Resend failure can't break the underlying action.
- `lib/rate-limit.ts` — generic fixed-window limiter (Upstash REST pipeline with in-memory fallback) + `hashIp()`; note `app/api/lead` uses `@upstash/ratelimit` directly instead.
- `lib/analytics.ts`, `lib/datadog.ts`, `lib/intercom.ts`, `lib/intercom-jwt.ts`, `lib/intercom-hmac.ts` — analytics + support widget.
- `lib/agent/` — embedded Claude Agent SDK + Composio (see above).
- `lib/jeremy-data.ts` — founder profile content used by landing components.
- `lib/utils.ts` — `isAdminEmail()` lives here (admin gate); also shared cn/format helpers.
- `lib/database.types.ts` — **generated**, regenerate with `pnpm db:types`.
- `lib/actions/` — **server-action layer**. Every file is a `"use server"` module; all return a discriminated `{ ok: true, data } | { ok: false, error }` shape so callers can branch without throwing. Server-only by transitive import of `next/headers` from `@/lib/supabase/server`.
  - `auth.ts` — `requireUser()` (cookie-bound client + authenticated user) and `requireAdmin()` (same + `isAdminEmail()` gate + admin client) shared guards. Throws `AuthError("not_authenticated" | "forbidden")`.
  - `work-orders.ts` — `submitWorkOrder` (client), `quoteWorkOrder` (admin), `acceptWorkOrderQuote` (client, owner-only — triggers Stripe invoice creation via `lib/invoice-creation.ts`), `updateWorkOrderStatus` (admin). Resend notifications on each transition, all non-fatal.
  - `projects.ts` — `createProject` / `updateProject` / `deleteProject` (admin CRUD). Cascade-deletes `project_files` per the FK ON DELETE CASCADE.
  - `invoices.ts` — `createInvoice` (admin, Stripe-hosted) and `markInvoicePaidManually` (admin escape-hatch for payments outside Stripe).
  - `users.ts` — `inviteUser` (Supabase `auth.admin.inviteUserByEmail`; `handle_new_user` trigger creates the profile) and `updateUser` (admin).
  - `files.ts` — admin deliverable uploads. Bytes must NOT flow through a server action (~1MB body cap vs 25MB ceiling): the action mints a signed upload URL, the browser PUTs directly to the `project-files` bucket (`components/admin/DeliverableUpload.tsx`). Downloads go through `app/api/files/[id]`.
  - `profile.ts` — `updateProfile` (cookie-bound; RLS enforces ownership). `phone` and `notify_email` are persisted since `20260618000100_profiles_prefs_phone.sql`.
  - `__test-helpers.ts` — `buildStubClient()` chainable mock used by all `lib/actions/*.test.ts`. Don't reach for `vi.mock("@supabase/...")` in new action tests; use this helper.

### Env vars (server-only unless noted)
| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY` | Browser + cookie-bound Supabase clients (client-exposed). Provisioned by the Vercel Marketplace Supabase integration; the `NEXT_PUBLIC_` URL is a manually-added mirror of `VERCEL_SUPABASE_URL`. |
| `VERCEL_SUPABASE_URL` | Server-only Supabase URL. `createClient()` and `createAdminClient()` fall back to this when `NEXT_PUBLIC_VERCEL_SUPABASE_URL` is unset. |
| `VERCEL_SUPABASE_SERVICE_ROLE_KEY` | `createAdminClient()` — bypasses RLS. Required for admin pages + `/api/lead`. Auto-provisioned by the Marketplace integration. |
| `ADMIN_EMAILS` | Comma-separated. Drives `isAdminEmail()` — the actual admin gate. |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | HMAC verification for `/api/webhooks/calendly`. Webhook returns 503 if unset. |
| `TYPEFORM_WEBHOOK_SECRET` | HMAC verification for `/api/typeform/webhook`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe invoicing + `/api/webhooks/stripe` signature verification. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Production rate limiting (Vercel Marketplace Upstash add-on). Absent → in-memory fallback (per-instance only). |
| `APOLLO_API_KEY` | Apollo upsert in `processLead()`. |
| `CUSTOMERIO_SITE_ID`, `CUSTOMERIO_API_KEY` | Customer.io identify + `lead_captured`. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO` | Transactional email via `lib/resend.ts`. |
| `COMPOSIO_API_KEY`, `ANTHROPIC_API_KEY`, `AGENT_USER_ID` | Embedded agent (`lib/agent/`, `scripts/agent.ts`). Unset → agent surface degrades to `not_configured`. |
| `GITHUB_TOKEN` | `/api/github-activity` + `/api/github-repo` (the `/repos` showcase page). |
| `INTERCOM_API_SECRET` | Server-side JWT signing for Intercom Secure Messenger (`lib/intercom-jwt.ts`, `/api/intercom/jwt`). Unset → anonymous legacy boot. |
| `INTERCOM_IDENTITY_VERIFICATION_SECRET` | Legacy HMAC (`lib/intercom-hmac.ts`); superseded by `INTERCOM_API_SECRET` when JWT is enabled. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata/emails. |
| `NEXT_PUBLIC_AMPLITUDE_API_KEY` | Amplitude browser key (public). Absent → Amplitude skipped. `NEXT_PUBLIC_AMPLITUDE_REPLAY_SAMPLE_RATE` (0–1, default 1) throttles Session Replay. |
| `NEXT_PUBLIC_*` (PostHog, Mixpanel, Intercom, Datadog) | Per-provider client-side analytics — feature-flagged by presence. GA4/GTM load via `<Script>` in `app/layout.tsx`. |

## Quality standards
- **Lighthouse targets** (informational, not a build gate): Performance ≥90, Accessibility ≥95, Best Practices ≥90, SEO ≥95.
- **Immutability** in `lib/*` helpers — never mutate inputs; return new objects.
- **Validate API inputs with Zod** (see `app/api/lead/route.ts` for the pattern).
- **`lib/database.types.ts` is generated** — regenerate with `pnpm db:types`, never hand-edit.
- **Lazy-load heavy embeds** — Calendly/Typeform-style components hidden behind dialogs/tabs must use `next/dynamic`, not static imports (see `.jules/bolt.md`).

## Conventions
- Path alias `@/*` -> repo root (e.g. `@/lib/supabase/server`).
- shadcn/ui primitives live in `components/ui/`; brand mark in `components/brand/`.
- Theming via `next-themes`, `attribute="class"`, three modes (Light/Dark/System); Dobeu Design System v2 tokens in `app/globals.css` and `tailwind.config.ts`.
- **Node version policy** — `engines.node` is `>=20` in `package.json`; `.nvmrc` is `20`; CI reads `node-version-file: .nvmrc`. Bumping the major is a deliberate change requiring all of these updated together.
- **Edge runtime policy** — only use `export const runtime = "edge"` for routes that genuinely need per-request edge execution (auth-adjacent middleware, geo-personalization). Don't use it for static metadata routes (OG images, sitemap, robots) — Next.js will warn that static generation is disabled and the asset will be rebuilt per request. `pnpm verify` blocks regressions via `scripts/strict-build.mjs`. Stripe webhook is the inverse case: it must stay `nodejs`.
- Env: run `vercel env pull .env.local` (Vercel-managed Supabase + analytics envs auto-fill). `NEXT_PUBLIC_*` keys are client-exposed; everything else is server-only.

## Deployment
Vercel (`vercel.json` — region `iad1`; `docs/DEPLOYMENT.md`). The config now defines **two services** (`web` = Next.js via `pnpm build`, `oci` = the container function — see "Second Vercel service" above), the `/oci` rewrites, cache-control headers, and git deploy gating (`main` only). Root operator scripts — convenience only, nothing in the app depends on them:
- `start-dev.cmd` / `start-dev.ps1` — local dev server shortcuts.
- `deploy-vercel.cmd` — production deploy shortcut.
- `close-stale-prs.cmd` — bulk-close stale PRs.

Don't add new `.cmd` wrappers for work `git` already does. `scripts/set-user-password.mjs` is an operator escape hatch for Supabase auth; `scripts/post-merge-smoke.md` is the manual post-merge smoke checklist.

## Untracked working-tree noise
A few patterns show up regularly in `git status` and are **not** project artifacts you should commit or "clean up" without checking:

- `.reports/` -- output dir for analysis tooling (e.g. `dead-code-analysis.md`). Treat as scratch; not currently in `.gitignore`. Re-run `pnpm dlx knip` + `pnpm dlx ts-prune` at HEAD before acting on stale reports.
- `_tmp_16_<hash>` files in the repo root -- ephemeral tool/agent scratch files. Safe to delete locally; don't commit.
- `.jules/*.md` -- learning notes written by the Jules agent (`bolt.md` and `sentinel.md` are tracked; new files appear untracked). Real lessons live there — read before deleting.
- New `*.cmd` files appearing untracked -- usually one-shot operator scripts. Confirm intent before deleting; the tracked keep-list is `start-dev.cmd`, `deploy-vercel.cmd`, and `close-stale-prs.cmd`.
