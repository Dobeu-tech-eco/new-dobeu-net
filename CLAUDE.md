# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`dobeu.net` v3 — Next.js 15 (App Router) marketing landing + minimal client portal for Dobeu Tech Solutions. TypeScript, Tailwind, shadcn/ui, Supabase backend, deployed to Vercel.

`BRAINSTORM.md` and `PLAN.md` are the source of truth for scope, decisions, and verification gates. `PLAN.md` Phase 2C scaffolds several `/admin/*` pages that still need their data layer wired.

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
```

Supabase (local stack via Docker):

```bash
pnpm supabase start            # local Postgres + Auth
pnpm supabase db push          # apply migrations in supabase/migrations/
pnpm db:types                  # regenerate lib/database.types.ts from local schema
```

> `vitest.config.ts` and `playwright.config.ts` are committed. Unit tests live alongside source (`lib/*.test.ts`). E2E tests live in `e2e/`. Run `pnpm test:ci` for unit tests and `pnpm test:e2e` for Playwright smoke tests.

## Build verification

`next.config.ts` sets `typescript.ignoreBuildErrors: false` and `eslint.ignoreDuringBuilds: false` -- **the build is a real verifier now**. A green `pnpm build` means the code typechecks and lints. For a full pre-merge check, run `pnpm verify` (type-check + lint + test:ci + build).

## Architecture

### Three-surface app, one Next.js project
- **`app/` (root)** -- public marketing landing, composed from `components/landing/*` (Hero, Services, FAQ, LeadForm, lightbox-based booking/Typeform tabs).
- **`app/portal/*`** -- authenticated client area (projects, files, invoices, messages, settings). Requires a logged-in Supabase user.
- **`app/admin/*`** -- admin-only dashboards. Gated in `app/admin/layout.tsx` by `isAdminEmail(user.email)` (from `lib/utils.ts`, backed by the `ADMIN_EMAILS` env var) **in addition to** Postgres RLS.

### Supabase access pattern (three clients -- pick deliberately)
- `lib/supabase/client.ts` -- browser client.
- `lib/supabase/server.ts` -> `createClient()` -- request-cookie-bound client for Server Components / Route Handlers / Server Actions; respects RLS as the logged-in user.
- `lib/supabase/server.ts` -> `createAdminClient()` -- **service-role, bypasses RLS, server-only**. Use only for admin ops and webhooks (e.g. the lead API). Throws if `SUPABASE_SERVICE_ROLE_KEY` is missing.
- `lib/supabase/middleware.ts` + root `middleware.ts` -- refreshes the auth session on every request (matcher excludes static assets).

All `/admin/*` and `/api/lead` use `export const dynamic = "force-dynamic"` because they read per-request auth/cookies and must never be statically pre-rendered.

### Database & RLS
Single migration `supabase/migrations/20260521000000_initial_schema.sql` defines: `profiles`, `projects`, `project_files`, `invoices`, `messages`, `leads`, `bookings`, `page_events`. **RLS is enabled on every table** -- users see only their own rows, admins (`profiles.is_admin`) see all. A `handle_new_user` trigger auto-creates a `profiles` row on signup. `lib/database.types.ts` is generated, not hand-edited -- regenerate with `pnpm db:types`.

### Lead pipeline (`app/api/lead/route.ts`)
A public `POST` that fans out, each step best-effort / non-fatal so one failure never breaks the user flow: (1) insert into Supabase `leads` via admin client -> (2) upsert Apollo contact (`lib/apollo.ts`) -> (3) write Apollo id back -> (4) Customer.io identify + `lead_captured` event (`lib/customerio.ts`) -> (5) Resend confirmation to lead + notification to admin. Input is validated with Zod; in-memory per-IP rate limit (5/min) -- replace with Upstash for real production.

### Client-side analytics fan-out (`lib/analytics.ts`)
`"use client"` module. One `track()`/`identify()` call dispatches to PostHog + Mixpanel + GA4 (gtag) + GTM dataLayer. **Consent-gated**: `initAnalytics(consent)` no-ops until the user consents (cookie-consent banner). Each provider is independently feature-flagged by the presence of its `NEXT_PUBLIC_*` env key. (The README references a `lib/analytics-server.ts` for sensitive server events -- not yet present.) Datadog RUM/Logs (`lib/datadog.ts`) and Intercom (`lib/intercom.ts`) wire in via `components/analytics-provider.tsx` / `app/layout.tsx`.

### Security headers / CSP
`next.config.ts` builds a strict Content-Security-Policy plus HSTS, X-Frame-Options, etc., applied to all routes. **When adding any third-party script, embed, or API host, add its domains to the relevant CSP array** (`script`, `connect`, `frame`, `font`, `style`) or it will be blocked at runtime. CSP arrays are intentionally split line-per-entry so git keeps treating the file as text.

## Conventions
- Path alias `@/*` -> repo root (e.g. `@/lib/supabase/server`).
- shadcn/ui primitives live in `components/ui/`; brand mark in `components/brand/`.
- Theming via `next-themes`, `attribute="class"`, three modes (Light/Dark/System); Dobeu Design System v2 tokens in `app/globals.css` and `tailwind.config.ts`.
- Env: copy `.env.example` -> `.env.local`. `NEXT_PUBLIC_*` keys are client-exposed; everything else (`SUPABASE_SERVICE_ROLE_KEY`, `APOLLO_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, etc.) is server-only.

## Deployment
Vercel (`vercel.json`, `docs/DEPLOYMENT.md`). The root contains many `*.cmd` helper scripts for committing/pushing/deploying from Windows -- these are ad-hoc operator scripts, not part of the app.
