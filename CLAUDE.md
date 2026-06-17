# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`dobeu.net` v3 — Next.js 15 (App Router) marketing landing + minimal client portal for Dobeu Tech Solutions. TypeScript, Tailwind, shadcn/ui, Supabase backend, deployed to Vercel.

`BRAINSTORM.md` and `PLAN.md` are the source of truth for scope, decisions, and verification gates. `PLAN.md` Phase 2C left the admin surface as **read-only list scaffolds**: `app/admin/{bookings,invoices,projects,users,leads}/page.tsx` already query Supabase via `createAdminClient()`; `app/admin/analytics/` is the only true UI-only scaffold. The missing work is detail / edit / create flows, booking sync, analytics embeds, and invoice/project/user mutations. Use `app/admin/leads/page.tsx` as one reference for read-only admin-table wiring — it's representative, not "more complete."

Sibling agent-instruction files (`AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`) are **thin pointers only**. Do not duplicate architectural guidance there — update this file instead. They exist solely because Codex / Gemini CLI / Copilot look for those filenames.

## Commands

Package manager is **pnpm** (`packageManager: pnpm@11.1.3`, Node >=20).

```bash
pnpm dev                       # dev server -> http://localhost:3000
pnpm build                     # production build
pnpm type-check                # tsc --noEmit
pnpm lint                      # next lint  (pnpm lint:fix to autofix)
pnpm test                      # vitest (watch)
pnpm test:ci                   # vitest run (one-shot)
pnpm test:e2e                  # playwright   (pnpm test:e2e:ui for UI mode)
pnpm verify                    # type-check && lint && test:ci && build -- run before merging to main
                               # CI (.github/workflows/ci.yml) runs install + type-check + lint + test:ci + build.
```

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

For a full pre-merge check, run `pnpm verify` (`type-check && lint && test:ci && build`), which mirrors CI locally.

## Architecture

### Three-surface app, one Next.js project
- **`app/` (root)** -- public marketing landing, composed from `components/landing/*` (Hero, Services, FAQ, LeadForm, lightbox-based booking/Typeform tabs).
- **`app/portal/*`** -- authenticated client area (projects, files, invoices, messages, settings). Requires a logged-in Supabase user.
- **`app/admin/*`** -- admin-only dashboards. **App-layer gated** in `app/admin/layout.tsx` by `isAdminEmail(user.email)` (from `lib/utils.ts`, backed by the `ADMIN_EMAILS` env var). Most admin pages read through `createAdminClient()` (service role), so **RLS is not the active enforcement layer for admin reads today** — the `ADMIN_EMAILS` check is.

### Supabase access pattern (three clients -- pick deliberately)
- `lib/supabase/client.ts` -- browser client.
- `lib/supabase/server.ts` -> `createClient()` -- request-cookie-bound client for Server Components / Route Handlers / Server Actions; respects RLS as the logged-in user.
- `lib/supabase/server.ts` -> `createAdminClient()` -- **service-role, bypasses RLS, server-only**. Use only for admin ops and webhooks (e.g. the lead API). Throws if `VERCEL_SUPABASE_SERVICE_ROLE_KEY` is missing.
- `lib/supabase/middleware.ts` + root `middleware.ts` -- refreshes the auth session on every request (matcher excludes static assets).

All `/admin/*` and `/api/lead` use `export const dynamic = "force-dynamic"` because they read per-request auth/cookies and must never be statically pre-rendered.

### Database & RLS
Single migration `supabase/migrations/20260521000000_initial_schema.sql` defines: `profiles`, `projects`, `project_files`, `invoices`, `messages`, `leads`, `bookings`, `page_events`. **RLS is enabled on every table** — users see only their own rows; admin reads use `createAdminClient()` (service role). The `profiles.is_admin` column was dropped in `20260616000000_phase5_drop_is_admin.sql`; `ADMIN_EMAILS` is the sole admin gate. A `handle_new_user` trigger auto-creates a `profiles` row on signup. `lib/database.types.ts` is generated, not hand-edited — regenerate with `pnpm db:types`.

### Lead pipeline (`lib/leads.ts` -> `processLead()`)
The fan-out lives in `lib/leads.ts` so every lead entry point shares one code path. Each step is best-effort / non-fatal so one failure never drops the lead: (1) insert into Supabase `leads` via admin client -> (2) upsert Apollo contact (`lib/apollo.ts`) -> (3) write Apollo id back -> (4) Customer.io identify + `lead_captured` event (`lib/customerio.ts`) -> (5) Resend confirmation to lead + notification to admin.

Entry points that call `processLead()`:
- **`app/api/lead/route.ts`** -- public `POST` (the landing-page form). Zod-validated, in-memory per-IP rate limit (5/min). Upstash Redis is the documented production upgrade path; in-memory is an accepted risk until traffic warrants the swap.
- **`app/api/webhooks/calendly/route.ts`** -- Calendly `invitee.created` webhook. Verifies the `Calendly-Webhook-Signature` HMAC (`lib/calendly.ts`) before trusting the payload; gated on `CALENDLY_WEBHOOK_SIGNING_KEY` (returns 503 / never accepts unsigned calls when unset). This is where a booking actually becomes a lead -- the client-side Calendly embed only exposes URIs, not email/name.

### Client-side analytics fan-out (`lib/analytics.ts`)
`"use client"` module. One `track()` call dispatches to PostHog + Mixpanel + GA4 (gtag) + GTM dataLayer. **Consent-gated**: `initAnalytics(consent)` no-ops until the user consents (cookie-consent banner). Each provider is independently feature-flagged by the presence of its `NEXT_PUBLIC_*` env key. Datadog RUM/Logs (`lib/datadog.ts`) and Intercom (`lib/intercom.ts`) wire in via `components/analytics-provider.tsx` / `app/layout.tsx`.

### Security headers / CSP
`next.config.ts` builds a strict Content-Security-Policy plus HSTS, X-Frame-Options, etc., applied to all routes. **When adding any third-party script, embed, or API host, add its domains to the relevant CSP array** (`script`, `connect`, `frame`, `font`, `style`) or it will be blocked at runtime. CSP arrays are intentionally split line-per-entry so git keeps treating the file as text.

### `lib/` map
- `lib/supabase/{client,server,middleware}.ts` — the three clients described above.
- `lib/leads.ts` — `processLead()` fan-out (single shared path).
- `lib/apollo.ts`, `lib/customerio.ts`, `lib/calendly.ts`, `lib/typeform.ts` — third-party integrations called from the lead pipeline / webhooks.
- `lib/analytics.ts` — client-side fan-out (PostHog + Mixpanel + GA4 + GTM dataLayer).
- `lib/datadog.ts`, `lib/intercom.ts` — observability + support widget, wired via `components/analytics-provider.tsx`.
- `lib/utils.ts` — `isAdminEmail()` lives here (admin gate); also shared cn/format helpers.
- `lib/database.types.ts` — **generated**, regenerate with `pnpm db:types`.
- `lib/actions/` — **server-action layer** (Phase 2). Every file is a `"use server"` module; all return a discriminated `{ ok: true, data } | { ok: false, error }` shape so callers can branch without throwing. Server-only by transitive import of `next/headers` from `@/lib/supabase/server`.
  - `auth.ts` — `requireUser()` (cookie-bound client + authenticated user) and `requireAdmin()` (same + `isAdminEmail()` gate + admin client) shared guards. Throws `AuthError("not_authenticated" | "forbidden")`.
  - `work-orders.ts` — `submitWorkOrder` (client), `quoteWorkOrder` (admin), `acceptWorkOrderQuote` (client, owner-only), `updateWorkOrderStatus` (admin). The owner email side-effects (Resend) and the Stripe-invoice creation triggered by `acceptWorkOrderQuote` are intentionally `// PHASE 3:` markers — not silent stubs.
  - `projects.ts` — `createProject` / `updateProject` / `deleteProject` (admin CRUD). Cascade-deletes `project_files` per the FK ON DELETE CASCADE.
  - `invoices.ts` — `createInvoice` (admin, inserts draft row; `stripe_invoice_id` + `hosted_invoice_url` are NULL until Phase 3) and `markInvoicePaidManually` (admin escape-hatch for cash / wire / check payments outside Stripe).
  - `profile.ts` — `updateProfile` (cookie-bound; RLS enforces ownership). `phone` is currently dropped on the floor — the column doesn't exist on `profiles` yet; see returned `unstored_phone` for visibility.
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
| `STRIPE_SECRET_KEY` | Invoice/payment surfaces. |
| `INTERCOM_IDENTITY_VERIFICATION_SECRET` | Server-side HMAC for Intercom Identity Verification (`lib/intercom-hmac.ts`). Unset → Intercom boots unverified. Must also be set in the Intercom workspace dashboard. |
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
