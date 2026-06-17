# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`dobeu.net` v3 — Next.js 15 (App Router) marketing landing + minimal client portal for Dobeu Tech Solutions. TypeScript, Tailwind, shadcn/ui, Supabase backend, deployed to Vercel.

`BRAINSTORM.md` and `PLAN.md` are the source of truth for scope, decisions, and verification gates. `PLAN.md` Phase 2C left the admin surface as **read-only list scaffolds**: `app/admin/{bookings,invoices,projects,users,leads}/page.tsx` already query Supabase via `createAdminClient()`; `app/admin/analytics/` is the only true UI-only scaffold. The missing work is detail / edit / create flows, booking sync, analytics embeds, and invoice/project/user mutations. Use `app/admin/leads/page.tsx` as one reference for read-only admin-table wiring — it's representative, not "more complete."

Sibling agent-instruction files (`AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`) are **thin pointers only**. Do not duplicate architectural guidance there — update this file instead. They exist solely because Codex / Gemini CLI / Copilot look for those filenames.

## Commands

Package manager is **pnpm** (`packageManager: pnpm@10.34.1`, Node >=20).

```bash
pnpm dev                       # dev server -> http://localhost:3000
pnpm build                     # production build
pnpm type-check                # tsc --noEmit
pnpm lint                      # next lint  (pnpm lint:fix to autofix)
pnpm test                      # vitest (watch)
pnpm test:ci                   # vitest run (one-shot)
pnpm test:e2e                  # playwright   (pnpm test:e2e:ui for UI mode)
pnpm format                    # prettier --write .
pnpm verify                    # type-check && lint && test:ci && build:strict -- run before merging to main
                               # CI (.github/workflows/ci.yml) runs install + type-check + lint + test:ci + build.
```

`verify` runs `build:strict` (`scripts/strict-build.mjs`), not plain `build` -- see **Build verification** below. `pnpm start` serves a production build locally.

Supabase (local stack via Docker):

```bash
pnpm supabase start            # local Postgres + Auth
pnpm supabase db push          # apply migrations in supabase/migrations/
pnpm db:types                  # regenerate lib/database.types.ts from local schema
```

## Testing
- **Vitest** — `vitest.config.ts`, tests colocated as `*.test.ts(x)` under `app/` and `lib/`. Run a single file: `pnpm test:ci -- lib/leads.test.ts`. Focus by name: `pnpm test:ci -- -t "processLead"`.
- **Playwright** — `playwright.config.ts` + `e2e/*`. Smoke-only today. Run with `pnpm test:e2e` (or `pnpm test:e2e:ui` for UI mode).
- CI runs `pnpm test:ci` in `.github/workflows/ci.yml` alongside type-check, lint, and build.

## Build verification

`next.config.ts` sets `typescript.ignoreBuildErrors: false` and `eslint.ignoreDuringBuilds: false` -- **the build is a real verifier now**. A green `pnpm build` means the code typechecks and lints.

For a full pre-merge check, run `pnpm verify` (`type-check && lint && test:ci && build:strict`), which mirrors CI locally. `build:strict` is plain `next build` wrapped by `scripts/strict-build.mjs`, which additionally fails on the `Detected "engines"` and `currently disables static generation` warnings (see **Edge runtime policy** in Conventions).

## Architecture

### Three-surface app, one Next.js project
- **`app/` (root)** -- public marketing landing, composed from `components/landing/*` (Hero, Services, FAQ, LeadForm, lightbox-based booking/Typeform tabs).
- **`app/portal/*`** -- authenticated client area (projects, files, invoices, tickets, settings — incl. `settings/mfa`). Requires a logged-in Supabase user.
- **`app/admin/*`** -- admin-only dashboards (bookings, invoices, projects, users, leads, tickets, analytics). **App-layer gated** in `app/admin/layout.tsx` by `isAdminEmail(user.email)` (from `lib/utils.ts`, backed by the `ADMIN_EMAILS` env var). Most admin pages read through `createAdminClient()` (service role), so **RLS is not the active enforcement layer for admin reads today** — the `ADMIN_EMAILS` check is.

Sign-in lives at **`app/login/`** with the callback at **`app/auth/callback/`** — see **Auth** below.

### Supabase access pattern (three clients -- pick deliberately)
- `lib/supabase/client.ts` -- browser client.
- `lib/supabase/server.ts` -> `createClient()` -- request-cookie-bound client for Server Components / Route Handlers / Server Actions; respects RLS as the logged-in user.
- `lib/supabase/server.ts` -> `createAdminClient()` -- **service-role, bypasses RLS, server-only**. Use only for admin ops and webhooks (e.g. the lead API). Throws if `VERCEL_SUPABASE_SERVICE_ROLE_KEY` is missing.
- `lib/supabase/middleware.ts` + root `middleware.ts` -- refreshes the auth session on every request (matcher excludes static assets).

All `/admin/*` and `/api/lead` use `export const dynamic = "force-dynamic"` because they read per-request auth/cookies and must never be statically pre-rendered.

### Auth (magic-link + password + admin MFA)
- **Sign-in** — `app/login/LoginForm.tsx` is a dual-mode client form: **magic-link via `signInWithOtp`** is primary; **`signInWithPassword`** is a fallback toggle. OTP resend is throttled by a 60s cooldown persisted in `sessionStorage`. Magic links are sent with `emailRedirectTo: buildAuthCallbackUrl(nextPath)` (`lib/utils.ts`).
- **Callback** — `app/auth/callback/route.ts` (`force-dynamic`) calls `supabase.auth.exchangeCodeForSession(code)`, sanitizes `?next=` (`sanitizeNextPath()`), and redirects to `/portal` (or `/login?error=auth_callback_failed`).
- **Stray-`?code=` self-healing** — `lib/supabase/middleware.ts` 307-redirects any path **except** `/auth/callback` that carries a `?code=` to `/auth/callback`, so a misconfigured Supabase Redirect-URL allowlist still completes the exchange. Covered by `lib/supabase/middleware.test.ts`.
- **Session refresh + route gating** — the same middleware runs on every request: refreshes the session via `getUser()`, gates `/portal` (auth required) and `/admin` (auth + `isAdminEmail()`), and falls through gracefully when Supabase env is unset.
- **Admin MFA is mandatory** — both `app/admin/layout.tsx` and the middleware gate `/admin/*` on AAL2. An admin with **no** enrolled TOTP factor is redirected to `app/portal/settings/mfa/page.tsx` to enroll (`requiresMfaEnrollment()`, fail-closed); an admin with a factor but an AAL1 session is redirected to step up (`requiresAal2Stepup()`). Both helpers live in `lib/utils.ts`. The enrollment page is under `/portal` (auth-gated, never MFA-gated) to avoid a redirect loop. Enroll/status UI lives under `app/portal/settings/`.
- **Server-action guards** — `lib/actions/auth.ts` exposes `requireUser()` / `requireAdmin()` (see `lib/actions/` below).

### Database & RLS
Live tables: `profiles`, `projects`, `project_files`, `invoices`, `leads`, `bookings`, `page_events`, `work_orders`, `work_order_attachments` (the original `messages` table was **dropped** in Phase 1). **RLS is enabled on every table** — users see only their own rows; admin reads use `createAdminClient()` (service role). `ADMIN_EMAILS` is the sole admin gate. A `handle_new_user` trigger auto-creates a `profiles` row on signup. `lib/database.types.ts` is generated, not hand-edited — regenerate with `pnpm db:types`.

Migrations in `supabase/migrations/` (apply in order):
1. `20260521000000_initial_schema.sql` — initial tables + RLS + `handle_new_user` trigger.
2. `20260605000000_phase1_reconciliation.sql` — drops `messages`; neutralizes `is_admin`-dependent RLS policies; adds `invoices.hosted_invoice_url`; creates `work_orders` + `work_order_attachments` + the `work-order-attachments` storage bucket.
3. `20260615000000_phase3_stripe_customer_id.sql` — adds `profiles.stripe_customer_id` + partial unique index.
4. `20260616000000_phase5_drop_is_admin.sql` — physically drops `profiles.is_admin` (env-only gate from here on).
5. `20260617000000_live_schema_repair.sql` — production drift repair: adds `profiles.updated_at` + trigger, idempotent re-add of `stripe_customer_id`, **recreates the missing `projects` table**, and conditionally adds the FK `project_files.project_id → projects.id` when no orphans exist.
6. `20260618000000_workorder_invoice_linkage.sql` — makes `invoices.project_id` nullable + adds `invoices.user_id` (direct owner, with RLS extended to it) so a project-less work-order invoice is visible/payable; adds work-order lifecycle timestamps (`in_progress_at`/`delivered_at`/`closed_at`/`cancelled_at`).
7. `20260618000100_profiles_prefs_phone.sql` — adds `profiles.phone` + `profiles.notify_email`.

**These last two migrations are not yet reflected in a `pnpm db:types` run against the live target** (the MCP-reachable Supabase is the legacy DB, not the production project) — `lib/database.types.ts` was hand-synced to match. Regenerate once the target is applied + reachable.

### Lead pipeline (`lib/leads.ts` -> `processLead()`)
The fan-out lives in `lib/leads.ts` so every lead entry point shares one code path. Each step is best-effort / non-fatal so one failure never drops the lead: (1) insert into Supabase `leads` via admin client -> (2) upsert Apollo contact (`lib/apollo.ts`) -> (3) write Apollo id back -> (4) Customer.io identify + `lead_captured` event (`lib/customerio.ts`) -> (5) Resend confirmation to lead + notification to admin.

Entry points that call `processLead()`:
- **`app/api/lead/route.ts`** -- public `POST` (the landing-page form). Zod-validated (fields capped at 255 chars), per-IP rate limit (5/min) via `checkRateLimit()` from `lib/rate-limit.ts` (Upstash REST when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set, in-memory `Map` fallback otherwise; surfaces the backend via the `X-RateLimit-Backend` header). Raw IPs are never persisted — only a truncated SHA-256 (`hashIp()`).
- **`app/api/webhooks/calendly/route.ts`** -- Calendly `invitee.created` webhook. Verifies the `Calendly-Webhook-Signature` HMAC (`lib/calendly.ts`) before trusting the payload; gated on `CALENDLY_WEBHOOK_SIGNING_KEY` (returns 503 / never accepts unsigned calls when unset). This is where a booking actually becomes a lead -- the client-side Calendly embed only exposes URIs, not email/name.

### Stripe (`lib/stripe.ts` + `app/api/webhooks/stripe/route.ts`)
Server-only wrapper over the `stripe` SDK: lazy client; customer dedupe/create; `createHostedInvoice(...)` creates + finalizes a Stripe Invoice and returns the `hosted_invoice_url` persisted on `invoices.hosted_invoice_url` (portal "Pay" links straight to it). The webhook validates the `Stripe-Signature` and handles `invoice.paid` / `payment_failed` / `finalized` / `voided` → updates `invoices.status` / `paid_at` via the admin client, deduping event IDs through `lib/stripe-event-dedupe.ts`. Returns 503 when `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` is unset.

### File downloads (`app/api/files/[id]/download/route.ts`)
Authenticated `POST` that asserts `requireUser()` (401 if anonymous), looks up a `project_files` row via the RLS-bound server client, issues a 60s signed URL against the `project-files` bucket, and 303-redirects. RLS scopes to owner/admin as defense-in-depth.

### Embedded Claude Agent SDK + Composio Tool Router (`lib/agent/`)
Server-only; opens a per-user Composio tool-router session and runs the Agent SDK's `query()` against it. Surface: admin-only `app/api/agent/route.ts` (`isAdminEmail`-gated, force-dynamic). Env-gated by `COMPOSIO_API_KEY` + `ANTHROPIC_API_KEY` (`runAgent()` returns `{ ok: false, error: "not_configured" }` when missing); returns `{ ok: false, error: "sdk_not_installed" }` until the SDK packages are added. `permissionMode` defaults to `"default"`; never accept `"bypassPermissions"` from an end-user request body. Treat all tool output as untrusted.

### Client-side analytics fan-out (`lib/analytics.ts`)
`"use client"` module. One `track()` call dispatches to PostHog + Mixpanel + GA4 (gtag) + GTM dataLayer. **Consent-gated**: `initAnalytics(consent)` no-ops until the user consents (cookie-consent banner). Each provider is independently feature-flagged by the presence of its `NEXT_PUBLIC_*` env key. Datadog RUM/Logs (`lib/datadog.ts`) and Intercom (`lib/intercom.ts`) wire in via `components/analytics-provider.tsx` / `app/layout.tsx`.

### Security headers / CSP
`next.config.ts` builds a strict Content-Security-Policy plus HSTS, X-Frame-Options, etc., applied to all routes. **When adding any third-party script, embed, or API host, add its domains to the relevant CSP array** (`script`, `connect`, `frame`, `font`, `style`) or it will be blocked at runtime. CSP arrays are intentionally split line-per-entry so git keeps treating the file as text.

### `lib/` map
- `lib/supabase/{client,server,middleware}.ts` — the three clients described above.
- `lib/leads.ts` — `processLead()` fan-out (single shared path).
- `lib/apollo.ts`, `lib/customerio.ts`, `lib/calendly.ts`, `lib/typeform.ts` — third-party integrations called from the lead pipeline / webhooks.
- `lib/analytics.ts` — client-side fan-out (PostHog + Mixpanel + GA4 + GTM dataLayer).
- `lib/datadog.ts`, `lib/intercom.ts`, `lib/intercom-jwt.ts`, `lib/intercom-hmac.ts` — observability + support widget (Intercom JWT/HMAC signing), wired via `components/analytics-provider.tsx`.
- `lib/utils.ts` — `isAdminEmail()` (admin gate), `buildAuthCallbackUrl()` / `sanitizeNextPath()` / `requiresAal2Stepup()` (auth helpers); also shared cn/format helpers.
- `lib/stripe.ts` — Stripe SDK client. `lib/invoice-creation.ts` — **server-only** (not `"use server"`) invoice core: lazy-creates the Stripe customer, mirrors Stripe state onto a local `invoices` row, inserts a local row even on Stripe failure. Called by `lib/actions/invoices.ts` and `work-orders.ts` after their own authz.
- `lib/stripe-event-dedupe.ts` — process-local `Set` deduping Stripe webhook event IDs for `app/api/webhooks/stripe/route.ts` (downstream UPDATEs are idempotent, so a missed dedupe only costs an extra write).
- `lib/resend.ts`, `lib/resend-templates.ts` — Resend client + email templates (lead confirmation / admin notification / owner side-effects).
- `lib/rate-limit.ts` — `checkRateLimit(key, { windowSec, max })` fixed-window limiter; Upstash REST when `UPSTASH_REDIS_REST_*` is set, in-memory `Map` fallback otherwise. Used by `app/api/lead/route.ts`.
- `lib/agent/` — **server-only** embedded Claude Agent SDK + Composio tool-router (`runAgent()`); HTTP surface `app/api/agent/route.ts` is `isAdminEmail`-gated. Degrades to `{ ok: false, error }` when `ANTHROPIC_API_KEY` / `COMPOSIO_API_KEY` or the SDK packages are absent.
- `lib/database.types.ts` — **generated**, regenerate with `pnpm db:types`.
- `lib/actions/` — **server-action layer** (Phase 2). Every file is a `"use server"` module; all return a discriminated `{ ok: true, data } | { ok: false, error }` shape so callers can branch without throwing. Server-only by transitive import of `next/headers` from `@/lib/supabase/server`.
  - `auth.ts` — `requireUser()` (cookie-bound client + authenticated user) and `requireAdmin()` (same + `isAdminEmail()` gate + admin client) shared guards. Throws `AuthError("not_authenticated" | "forbidden")`.
  - `work-orders.ts` — `submitWorkOrder` (client; signed-URL attachment upload with MIME+25MB allowlist + best-effort `work_order_created` event), `quoteWorkOrder` (admin), `acceptWorkOrderQuote` (client, owner-only — sets `accepted`/`accepted_at` only; the admin button creates the invoice), `updateWorkOrderStatus` (admin). The status transitions (`open→quoted→accepted→in_progress→delivered→closed`, `cancelled` from any non-terminal) are **enforced** server-side, not just Zod-validated. Resend notifications are wired.
  - `projects.ts` — `createProject` / `updateProject` / `deleteProject` (admin CRUD). Cascade-deletes `project_files` per the FK ON DELETE CASCADE.
  - `invoices.ts` — `createInvoice` (admin; **real** Stripe-hosted invoice via `lib/invoice-creation.ts` → `lib/stripe.ts`, storing `stripe_invoice_id` + `hosted_invoice_url`; falls back to a local row with NULL Stripe ids only if the Stripe call fails), `createInvoiceForWorkOrder` (admin; creates the invoice for an accepted work order and back-links `work_orders.invoice_id`), and `markInvoicePaidManually` (admin escape-hatch for cash / wire / check). `invoices.project_id` is **nullable** and `invoices.user_id` is the direct owner so a project-less work-order invoice is still visible/payable under RLS.
  - `profile.ts` — `updateProfile` (cookie-bound; RLS enforces ownership). Persists `full_name`, `company`, `phone`, and `notify_email` (the `phone` + `notify_email` columns were added in `20260618000100_profiles_prefs_phone.sql`). `SettingsForm` only submits `phone`/`notify_email` when the page supplies their initial values (interlock against clobbering un-displayed columns).
  - `users.ts` — `inviteUser` (admin, `auth.admin.inviteUserByEmail`) / `updateUser` (admin, name+company). Invite delivery depends on Supabase SMTP being configured.
  - `files.ts` — admin deliverable upload to the `project-files` bucket (signed upload URL → client PUT → `project_files` row); MIME + 25MB allowlist.
  - `__test-helpers.ts` — `buildStubClient()` chainable mock used by all `lib/actions/*.test.ts`. Don't reach for `vi.mock("@supabase/...")` in new action tests; use this helper.

### Env vars (server-only unless noted)
| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_VERCEL_SUPABASE_URL`, `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY` | Browser + cookie-bound Supabase clients (client-exposed). Provisioned by the Vercel Marketplace Supabase integration; the `NEXT_PUBLIC_` URL is a manually-added mirror of `VERCEL_SUPABASE_URL`. |
| `VERCEL_SUPABASE_URL` | Server-only Supabase URL. `createClient()` and `createAdminClient()` fall back to this when `NEXT_PUBLIC_VERCEL_SUPABASE_URL` is unset. |
| `VERCEL_SUPABASE_SERVICE_ROLE_KEY` | `createAdminClient()` — bypasses RLS. Required for admin pages + `/api/lead`. Auto-provisioned by the Marketplace integration. |
| `ADMIN_EMAILS` | Comma-separated. Drives `isAdminEmail()` — the actual admin gate. |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | HMAC verification for `/api/webhooks/calendly`. Webhook returns 503 if unset. |
| `APOLLO_API_KEY` | Apollo upsert in `processLead()`. |
| `CUSTOMERIO_SITE_ID`, `CUSTOMERIO_API_KEY` | Customer.io identify + `lead_captured`. |
| `RESEND_API_KEY` | Confirmation + admin-notification emails. |
| `STRIPE_SECRET_KEY` | Invoice/payment surfaces (`lib/stripe.ts`). |
| `STRIPE_WEBHOOK_SECRET` | `Stripe-Signature` verification for `/api/webhooks/stripe`. Webhook returns 503 if unset. |
| `INTERCOM_API_SECRET` | Server-side JWT signing for Intercom Secure Messenger (`lib/intercom-jwt.ts`, `/api/intercom/jwt`). Unset → anonymous legacy boot. |
| `INTERCOM_IDENTITY_VERIFICATION_SECRET` | Legacy HMAC (`lib/intercom-hmac.ts`); superseded by `INTERCOM_API_SECRET` when JWT is enabled. |
| `NEXT_PUBLIC_*` (PostHog, Mixpanel, GA4, GTM, Intercom, Datadog) | Per-provider client-side analytics — feature-flagged by presence. |

## Quality standards
- **Lighthouse targets** (informational, not a build gate): Performance ≥90, Accessibility ≥95, Best Practices ≥90, SEO ≥95.
- **Immutability** in `lib/*` helpers — never mutate inputs; return new objects.
- **Validate API inputs with Zod** (see `app/api/lead/route.ts` for the pattern).
- **`lib/database.types.ts` is generated** — regenerate with `pnpm db:types`, never hand-edit.

## Conventions
- Path alias `@/*` -> repo root (e.g. `@/lib/supabase/server`).
- shadcn/ui primitives live in `components/ui/`; brand mark in `components/brand/`.
- Theming via `next-themes`, `attribute="class"`, three modes (Light/Dark/System); Dobeu Design System v2 tokens in `app/globals.css` and `tailwind.config.ts`.
- **Node version policy** — `engines.node` is pinned to `20.x` in `package.json`, mirrored in `.nvmrc` and `.github/workflows/ci.yml`. Bumping the major is a deliberate change requiring all three updated together. Don't loosen to `>=20.0.0` (Vercel warns and will auto-float to a new major) and don't pin to a specific minor (`20.18.0`) unless there's a real reason.
- **Edge runtime policy** — only use `export const runtime = "edge"` for routes that genuinely need per-request edge execution (auth-adjacent middleware, geo-personalization). Don't use it for static metadata routes (OG images, sitemap, robots) — Next.js will warn that static generation is disabled and the asset will be rebuilt per request. `pnpm verify` blocks regressions via `scripts/strict-build.mjs` (which fails on the `Detected "engines"` and `currently disables static generation` warnings); plain `pnpm build` (used by Vercel) stays lenient so a harmless future warning can't block production deploys.
- Env: run `vercel env pull .env.local` (Vercel-managed Supabase + analytics envs auto-fill). `NEXT_PUBLIC_*` keys are client-exposed; everything else (`VERCEL_SUPABASE_SERVICE_ROLE_KEY`, `APOLLO_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, etc.) is server-only.

## Deployment
Vercel (`vercel.json`, `docs/DEPLOYMENT.md`). Root has two operator `.cmd` scripts — convenience only, nothing in the app depends on them:
- `start-dev.cmd` — local dev server shortcut.
- `deploy-vercel.cmd` — production deploy shortcut.

Don't add new `.cmd` wrappers for work `git` already does.

## Untracked working-tree noise
A few patterns show up regularly in `git status` and are **not** project artifacts you should commit or "clean up" without checking:

- `.reports/` -- output dir for analysis tooling (e.g. `dead-code-analysis.md`). Treat as scratch; not currently in `.gitignore`. Re-run `pnpm dlx knip` + `pnpm dlx ts-prune` at HEAD before acting on stale reports.
- `_tmp_16_<hash>` files in the repo root -- ephemeral tool/agent scratch files. Safe to delete locally; don't commit.
- New `*.cmd` files appearing untracked -- usually one-shot operator scripts. Confirm intent before deleting; the keep-list is `start-dev.cmd` and `deploy-vercel.cmd` only.
- `.agent/scripts/*.mjs` -- migration/env operator helpers. `apply-phase5-migration.mjs` applies a live migration against prod (`node .agent/scripts/apply-phase5-migration.mjs` to inspect, `--apply` to execute) given `VERCEL_POSTGRES_URL_NON_POOLING`. `_restore-postgres-url.mjs` and `_check-postgres-env.mjs` are one-off recovery/preflight helpers — **do not reuse or commit** without checking; prefer `pnpm supabase db push` for normal migration flow.
