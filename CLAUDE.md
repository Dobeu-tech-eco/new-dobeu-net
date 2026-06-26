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
pnpm verify                    # type-check && lint && test:ci && build:strict -- run before merging to main
                               # CI (.github/workflows/ci.yml) runs install + type-check + lint + test:ci + build:strict.
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

For a full pre-merge check, run `pnpm verify` (`type-check && lint && test:ci && build:strict`), which mirrors CI locally.

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
- **`app/api/lead/route.ts`** -- public `POST` (the landing-page form). Zod-validated, Upstash Redis-backed per-IP rate limit (5/min) when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are present; falls back to the in-memory limiter for local/dev environments without Upstash credentials.
- **`app/api/webhooks/calendly/route.ts`** -- Calendly `invitee.created` webhook. Verifies the `Calendly-Webhook-Signature` HMAC (`lib/calendly.ts`) before trusting the payload; gated on `CALENDLY_WEBHOOK_SIGNING_KEY` (returns 503 / never accepts unsigned calls when unset). This is where a booking actually becomes a lead -- the client-side Calendly embed only exposes URIs, not email/name.

### Client-side analytics fan-out (`lib/analytics.ts`)
`"use client"` module. One `track()` call dispatches to PostHog + Mixpanel + GA4 (gtag) + GTM dataLayer. **Consent-gated**: `initAnalytics(consent)` no-ops until the user consents (cookie-consent banner). Each provider is independently feature-flagged by the presence of its `NEXT_PUBLIC_*` env key. Vercel Web Analytics + Speed Insights, Datadog RUM/Logs (`lib/datadog.ts`), and Intercom (`lib/intercom.ts`) wire in via `components/analytics-provider.tsx` / `app/layout.tsx`.

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
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Production `/api/lead` rate limiting through Upstash Redis. Missing locally -> in-memory fallback. |
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

### Vercel agent / platform review workflow
- For Vercel-related tasks, first inspect currently available MCP tools and prefer the Vercel MCP documentation/deployment/log tools when they apply. Use `search_vercel_documentation` for platform facts before relying on memory.
- Keep `AGENTS.md`, `GEMINI.md`, and `.github/copilot-instructions.md` as thin pointers. Do not run `vercel agent init` blindly if it would duplicate guidance into those files; place durable repo guidance here instead.
- The cloud checkout may not include `.vercel/project.json`. Do not auto-link, provision Marketplace resources, or run `vercel integration add` unless the operator explicitly requests it and the target Vercel project/team are verified.
- Deployment safety checks should cover `vercel.json`, `.github/workflows/ci.yml`, `next.config.ts`, CSP host allowlists, env documentation, and scans for deprecated Next.js, AI SDK, Workflow, or sunset storage patterns. Use `pnpm verify` for the local proof before shipping.

## Untracked working-tree noise
A few patterns show up regularly in `git status` and are **not** project artifacts you should commit or "clean up" without checking:

- `.reports/` -- output dir for analysis tooling (e.g. `dead-code-analysis.md`). Treat as scratch; not currently in `.gitignore`. Re-run `pnpm dlx knip` + `pnpm dlx ts-prune` at HEAD before acting on stale reports.
- `_tmp_16_<hash>` files in the repo root -- ephemeral tool/agent scratch files. Safe to delete locally; don't commit.
- New `*.cmd` files appearing untracked -- usually one-shot operator scripts. Confirm intent before deleting; the keep-list is `start-dev.cmd` and `deploy-vercel.cmd` only.

---

## Process Rules (Owner-Mandated — All Agents, Non-Negotiable)

These rules were set by Jeremy Williams (repo owner) and apply to every agent in every session.

### Pre-Session Hook (mandatory before any code action)

```bash
# Run this sequence before touching any file:
cat CLAUDE.md                               # 1. read full rulebook (this file)
cat .agent/HANDOFF.md                       # 2. previous agent notes + outstanding items
cat STATUS.md                               # 3. current phase + live blockers
git fetch --all && git status               # 4. sync — never work on stale state
git branch -a                               # 5. confirm branch architecture
gh pr list --repo Dobeu-tech-eco/dobeu-net --state open --json number,title,headRefName,baseRefName
                                            # 6. audit open PRs before creating new ones
# 7. Catalogue available tools (run ToolSearch or Composio_COMPOSIO_SEARCH_TOOLS)
# 8. Append session-open note to .agent/HANDOFF.md:
#    ## YYYY-MM-DD — [Agent] — OPEN
#    Intent: [what you plan to do this session]
```

### Post-Session Hook (mandatory before ending any session)

```bash
# Run before closing:
pnpm verify                                 # 1. full checkpoint gate (lint+tsc+tests+build)
# 2. Append session-close note to .agent/HANDOFF.md:
#    ## YYYY-MM-DD — [Agent] — CLOSE
#    Completed: [bullet list of files changed]
#    Outstanding: [bullet list with [ ] checkboxes]
#    Bugs found: [any new issues discovered]
#    Questions for Jeremy: [anything needing human input]
# 3. Update STATUS.md — mark completed items
git add -A
git commit -m "type(scope): description [checkpoint-N]"
git push origin <feature-branch>            # NEVER push to main or dev directly
```

### Branch Discipline

```
main  ←  production (dobeu.net) — NEVER delete, NEVER push directly
 └── dev  ←  staging (preview URL) — NEVER delete, NEVER push directly (create if missing)
      └── feature/*, fix/*, step-N-*  ←  all work branches
```

- PRs target `dev`, not `main` (except the final release PR)
- Max 3 open branches at any time — close stale ones before creating new
- Check for duplicate PRs before opening any new PR
- Final `dev → main` PR requires: Claude Code review + owner approval + all CI gates

### Checkpoint After Every Step

Run `.agent/CHECKPOINT.md` after each numbered implementation Step (1–6).
A step is **NOT** complete until checkpoint passes. See `.agent/CHECKPOINT.md` for full gate.

### Token Efficiency — Use Composio for Heavy Work

- `Composio_COMPOSIO_REMOTE_WORKBENCH` — sandboxed remote bash (preserves local token context)
- `Composio_COMPOSIO_MULTI_EXECUTE_TOOL` — parallel tool calls across multiple apps
- `Composio_COMPOSIO_SEARCH_TOOLS` — discover any connected app's available tools

### Multi-Agent QA Gate (required before dev → main)

Two independent agents must sign off before any merge to `main`:
1. **Agent 1:** `agent-browser` automated matrix — 6 viewports × 3 themes = 18 screenshots + axe audit
2. **Agent 2:** Vercel Preview + Lighthouse CI (all 4 gates: Perf ≥90, A11y ≥95, SEO 100, BP ≥95)
3. **Human:** Jeremy Williams reviews preview URL and approves
4. **Orchestrator:** compiles QA report, may request additional agent review before final sign-off

### Pending Workflow Files (owner action required)

New CI/CD workflows are staged in `.agent/workflows-pending/` because v0's GitHub App
lacks the `workflows` permission scope. Jeremy must install them manually:

```bash
cp .agent/workflows-pending/*.yml .github/workflows/
git add .github/workflows/
git commit -m "ci: add checkpoint, dev-preview, qa-matrix, release workflows"
git push origin dev
```

Staged files: `checkpoint.yml`, `dev-preview.yml`, `qa-matrix.yml`, `release.yml`

---

## Tool Inventory

### Vercel Project (CORRECTED 2026-06-20)

```
Project:   new-dobeu-net
ID:        prj_gsbOuACbBs2I8M1XSpDcdjoAENdb
URL:       https://vercel.com/dobeutechnology/new-dobeu-net/
Team:      team_8K43hpr1Nzs0UsjjUCGh8OBK (Dobeu Tech Solutions LLC)
CLI flag:  --scope team_8K43hpr1Nzs0UsjjUCGh8OBK
Repo:      Dobeu-tech-eco/dobeu-net
```

Note: The phantom project `dobeu-net` (`prj_H53tuPNNfVWhm54vkxxvo17CRZDX`) was deleted 2026-06-20.
`.vercel/project.json` (gitignored) holds the local link — correct project ID is above.

### MCP Servers (loaded in v0 session)

**Linear** (46 tools) — sprint tracking, issues, milestones, projects, teams, customers
Key tools: `Linear_get_issue`, `Linear_save_issue`, `Linear_list_projects`, `Linear_save_project`,
`Linear_list_teams`, `Linear_save_milestone`, `Linear_search_documentation`

**Composio** (7 meta-tools → 100+ connected apps)
- `Composio_COMPOSIO_SEARCH_TOOLS` — find any app's tool schemas
- `Composio_COMPOSIO_MULTI_EXECUTE_TOOL` — parallel execution across apps
- `Composio_COMPOSIO_REMOTE_WORKBENCH` — sandboxed remote bash
- `Composio_COMPOSIO_MANAGE_CONNECTIONS` — list/manage app connections
- `Composio_COMPOSIO_WAIT_FOR_CONNECTIONS` — await async connections
- `Composio_COMPOSIO_GET_TOOL_SCHEMAS` — get schemas without searching

**Composio-connected apps (user-authorized, relevant to Dobeu launch):**

| Category | Apps | Primary use in this project |
|---|---|---|
| Dev infra | `github`, `vercel`, `cloudflare`, `doppler`, `doppler_secretops`, `datadog`, `sentry`, `grafana`, `pagerduty`, `e2b` | CI/CD, DNS, secrets management, monitoring, alerting |
| AI/agents | `openai`, `anthropic_administrator`, `groqcloud`, `context7_mcp`, `v0`, `mem0`, `devin_mcp`, `cursor` | Models, live framework docs, agent coordination |
| Analytics | `posthog`, `semrush`, `microsoft_clarity`, `amplitude`, `mixpanel`, `launch_darkly` | Funnels, SEO research, heatmaps, feature flags |
| Communication | `slack`, `slackbot`, `gmail`, `zoom`, `discord` | Deploy notifications, client comms |
| Marketing | `klaviyo`, `customerio`, `apollo`, `peopledatalabs`, `serpapi` | Email automation, lead enrichment, keyword research |
| Booking/forms | `calendly`, `typeform` | Embedded in landing page |
| Payments | `stripe`, `coinbase` | Invoicing, checkout |
| Design | `figma`, `canva`, `screenshotone`, `hyperbrowser`, `browserbase_tool` | Design references, visual regression |
| Database | `supabase`, `neon`, `clickhouse`, `prisma` | Data operations |
| Research | `tavily`, `exa`, `perplexityai`, `context7_mcp`, `postman`, `npm` | Web research, live docs, API testing |
| Productivity | `googlecalendar`, `googledocs`, `googledrive`, `googlesheets`, `coda`, `airtable` | Docs, project management |
| Automation | `make` | Workflow automation |

**Priority map — which Composio tools to use per launch phase:**

| Phase/Step | Composio tools |
|---|---|
| Phase 0 — repo hygiene | `github` (close PRs, create dev branch) |
| Step 1 — infra repair | `context7_mcp` (Next.js/Tailwind docs), `vercel` (env vars), `doppler_secretops` (secrets sync) |
| Step 2 — performance | `datadog` (RUM baseline), `vercel` (Speed Insights) |
| Step 3 — SEO | `semrush` (keyword validation), `google*` (Search Console) |
| Step 5 — security | `cloudflare` (CSP/WAF), `doppler_secretops` (missing secrets), `sentry` (security monitoring) |
| Step 6 — UI/UX | `figma` (design refs), `posthog` (A/B flags), `screenshotone` (visual baseline) |
| Phase 3 — QA | `posthog` (funnel), `microsoft_clarity` (heatmaps), `screenshotone` (regression) |
| Phase 4 — deploy | `vercel` + `cloudflare` (DNS), `datadog` (alerts), `pagerduty` (incidents) |
| Ongoing | `posthog` (analytics), `sentry` (errors), `linear` (issues), `slack` (alerts) |

**Stripe MCP** (11 tools) — payment operations, webhook docs, invoice management
`stripe_search_stripe_documentation`, `stripe_get_stripe_account_info`, `stripe_create_refund`,
`stripe_search_stripe_resources`, `stripe_fetch_stripe_resources`, `stripe_stripe_implementation_planner`,
`stripe_stripe_api_search`, `stripe_stripe_api_details`, `stripe_stripe_api_read`, `stripe_stripe_api_write`

### V0 Built-in Skills

| Skill | Use in this project |
|---|---|
| `agent-browser` | Automated cross-device/theme QA, axe audits, Lighthouse vitals |
| `shadcn` | Component library, theme tokens, CLI workflows |
| `vercel-cli` | Project management, env vars, domains, logs |
| `vercel-flags` | A/B testing for CTA variant (Step 6i) |
| `github-cli` | PR management, branch ops, CI status checks |
| `thesvg` | Trust bar logos (Vercel, Stripe, Supabase, Next.js, Anthropic) |
| `charts` | Analytics dashboards in portal |
| `skill-creation` | Package new reusable workflows |
| `fal` | AI image generation for portfolio/case study assets |

### Vercel-labs Skills (installed in `.claude/skills/`)

`deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-composition-patterns`,
`vercel-optimize`, `vercel-react-best-practices`, `vercel-react-native-skills`,
`vercel-react-view-transitions`, `web-design-guidelines`, `writing-guidelines`

---

## Known Issues & Active Blockers

Current as of 2026-06-20. Update this table as items are resolved.

| # | Severity | Issue | Fix in | Status |
|---|---|---|---|---|
| B1 | CRITICAL | Root layout `title: 'v0 App'`, `description: 'Created with v0'`, `generator: 'v0.app'` live in production | Step 1 | Pending |
| B2 | CRITICAL | `ThemeProvider` never mounted — dark mode switching broken site-wide | Step 1 | Pending |
| B3 | CRITICAL | `AnalyticsProvider` never mounted — GTM/GA4/PostHog/Datadog/Intercom all non-functional | Step 1 | Pending |
| B4 | CRITICAL | Mobile LCP = 4.9s (target ≤2.5s) — Lighthouse mobile = 78/100 | Step 2 | Pending |
| B5 | HIGH | `package.json` specifies `tailwindcss: ^3.4.17` but `globals.css` uses Tailwind v4 syntax | Step 1 | Pending |
| B6 | HIGH | `DobeuMark` SVG mask IDs not scoped — logo renders incorrectly when 2+ instances on same page | Step 1 | Pending |
| B7 | HIGH | `dangerouslySetInnerHTML` used for static strings in 4 components (XSS surface, incorrect pattern) | Step 4 | Pending |
| B8 | HIGH | Focus ring set to `outline-ring/50` (50% opacity) — fails WCAG 2.4.11 focus appearance | Step 4 | Pending |
| B9 | HIGH | In-memory rate limiter resets on cold starts — provides zero distributed protection | Step 5 | Pending |
| B10 | HIGH | `INTERCOM_IDENTITY_VERIFICATION_SECRET` not provisioned — client impersonation risk | Step 5 | Pending |
| B11 | HIGH | Stripe webhook endpoint subscription not confirmed — invoice.paid events not processed | Step 5 | Pending |
| B12 | HIGH | No skip-to-main-content link — WCAG 2.4.1 Level A failure | Step 4 | Pending |
| B13 | HIGH | Cookie consent dialog missing `aria-modal="true"` — AT users can tab behind banner | Step 4 | Pending |
| B14 | MEDIUM | Page-level `metadata` has no `description`, `openGraph`, or `twitter` card | Step 3 | Pending |
| B15 | CRITICAL | `dev` branch does not exist — required before any code work begins | Phase 0 | Pending |
| B16 | HIGH | Duplicate PRs #92, #93, #94 open (duplicates of #101, #100, #102) | Phase 0 | Pending |
| B17 | MEDIUM | LinkedIn URL `linkedin.com/in/jeremy-williams` likely resolves to wrong person | Step 6 | Pending |
| B18 | NEW | Dependabot: 12 vulnerabilities on default branch (1 high, 8 moderate, 3 low) | Step 5 | Pending |

---

## Launch Plan — Phase & Step Reference

Full detail in `.agent/PRODUCTION-PLAN.md`. Quick reference:

```
PHASE 0  — Repo hygiene: create dev branch, close #92/#93/#94, consolidate PRs → dev
STEP 1   — Core infra repair (B1–B6) + CSS tokens + fonts       → CHECKPOINT 1
STEP 2   — Performance: LCP 4.9s → ≤2.5s, Lighthouse ≥90       → CHECKPOINT 2
STEP 3   — SEO: metadata, structured data, OG image, sitemap    → CHECKPOINT 3
STEP 4   — Accessibility: WCAG AA, skip nav, ARIA, focus rings  → CHECKPOINT 4
STEP 5   — Security: Upstash rate limit, CSP nonces, Dependabot → CHECKPOINT 5
STEP 6   — UI/UX polish: CTA hierarchy, trust logos, A/B setup  → CHECKPOINT 6
PHASE 3  — Multi-agent QA gate (automated + CI + human)
PHASE 4  — dev → main PR + production deploy + smoke test
PHASE 5  — CI/CD workflow enhancements committed to main
```

**Clarification questions still awaiting Jeremy's answers (from initial audit):**
- Q1: Font choice — Geist (current) vs Nunito (brand spec)?
- Q2: Are testimonial quotes in `Proof.tsx` real/attributable?
- Q3: Stat accuracy — "17 Properties built" — current and verifiable?
- Q6: What does "Stripe-verified" mean in Hero subtitle?
- Q8: Correct LinkedIn URL for Jeremy Williams?
