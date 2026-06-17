# dobeu.net v3 — Status

_Last updated: 2026-06-16 — Phases 4–5 shipped on `main`; Phase 5 migration applied on live Vercel Supabase._

> **Convergence:** see [`.agent/convergence/2026-06-05-production-readiness.md`](.agent/convergence/2026-06-05-production-readiness.md) for the full production-readiness verdict (✅ READY TO MERGE), operator checklist, legacy-cutover status, post-merge smoke path, and merge strategy.

## Phase tracker (vs `.agent/PRODUCTION-PLAN.md`)

| Phase | Scope | Status |
|---|---|---|
| **0 — Launch** | Stack, brand v2, landing, portal/admin scaffolds, lead pipeline, analytics fan-out, security headers, magic-link auth, deploy to Vercel | ✅ Shipped (commits up to `2a80db8`) |
| **1 — P0 + DB reconciliation** | `NEXT_PUBLIC_SITE_URL` guard, lead-table probe drop, intercom/admin-email dedup, draft reconciliation migration | ✅ Shipped (commit `9ceefa2`) — migration applied to Vercel Supabase in Phase 2 |
| **2 — Server-action foundation + portal/admin CRUD + work-order schema deployed** | `lib/actions/{work-orders,projects,invoices,profile}.ts` + tests; admin/projects write-CRUD; portal/settings update form; legacy env cleanup | ✅ Shipped |
| **3 — Stripe-hosted invoicing + work-order UI end-to-end + observability** | `lib/stripe.ts`, `/api/webhooks/stripe`, portal/admin `tickets` UIs, work-order Resend notifications, Datadog log drain | ✅ Shipped (live on `https://dobeu.net`, HEAD `4cc72f2`) |
| **4 — Auth hardening** | Supabase TOTP MFA (admin AAL2 gate), Intercom HMAC identity verification, rate-limit (in-memory accepted-risk) | ✅ **Code complete** (`test/coverage`, commits `1652f00`→`487fded`) |
| **5 — Polish** | Desktop Lighthouse ≥90, CI runs tests, a11y on ticket UIs, dead-code cleanup, drop `profiles.is_admin`, ticket E2E | ✅ **Shipped** — `profiles.is_admin` **dropped on live** (`ipmjokuezeuukhrilduq`, verified 2026-06-16) |

## Pending before production cutover (not code blockers)

These do not block the `test/coverage` → `main` merge; they gate full production cutover. Full detail + exact URLs/commands in the convergence doc.

1. ~~**Apply `20260616000000_phase5_drop_is_admin.sql` to live Vercel Supabase**~~ — **done** (manual SQL + script verify: `is_admin column present: NO`).
2. **Provision `INTERCOM_IDENTITY_VERIFICATION_SECRET`** in Vercel + enable Identity Verification in the Intercom workspace with the same secret (JWT path via `INTERCOM_API_SECRET` is live; legacy HMAC optional).
3. **Verify the Stripe webhook endpoint** (`/api/webhooks/stripe` subscribed to `invoice.paid`/`invoice.payment_failed`/`invoice.finalized`; signing secret matches `STRIPE_WEBHOOK_SECRET`).
4. **Resend DKIM/SPF** verified for `dobeu.net`; **Vercel ↔ GitHub** re-linked for auto-deploy.
5. **Legacy `db-dobeutech-unified` cutover** — Task Group C started; runbook at `.agent/migration/cutover-execute.md`, quick inventory prompt at `.agent/migration/RUN-INVENTORY-NOW.md`. **Blocked on** filling `.agent/migration/inventory.md` Findings. Target user data is empty today.

_Informational:_ mobile landing Lighthouse Performance ≈ 80 (target 90) is a deferred, non-gating follow-up (rationale in the convergence doc §7)._

## Database state (Vercel Supabase)

Per `.agent/migration/vercel-supabase-state.md` (verified 2026-06-16):

- `20260521000000_initial_schema.sql` — **applied**
- `20260605000000_phase1_reconciliation.sql` — **applied**
- `20260616000000_phase5_drop_is_admin.sql` — **applied** (`profiles.is_admin` absent)
- Tables present: `bookings`, `invoices`, `leads`, `page_events`, `profiles`, `project_files`, `projects`, `work_orders`, `work_order_attachments`
- `messages` dropped (Intercom owns chat)
- `invoices.hosted_invoice_url` column present (target of Phase 3 Stripe wiring)
- Storage buckets: `project-files`, `work-order-attachments`

> **Legacy `db-dobeutech-unified` cutover:** not started. Inventory queued separately at `.agent/migration/inventory.md`. The target Vercel Supabase is **empty user data** today; nothing to roll back.

## Phase 2 — what shipped in this commit

### Server-action foundation (`lib/actions/`)

- `auth.ts` — `requireUser()` / `requireAdmin()` shared guards.
- `work-orders.ts` — `submitWorkOrder`, `quoteWorkOrder`, `acceptWorkOrderQuote`, `updateWorkOrderStatus`. Functional + tested; UI wires up in Phase 3.
- `projects.ts` — `createProject`, `updateProject`, `deleteProject` (admin CRUD).
- `invoices.ts` — `createInvoice`, `markInvoicePaidManually` (DB-only; Stripe in Phase 3).
- `profile.ts` — `updateProfile` (cookie-bound client; RLS enforces ownership).

All actions return discriminated `{ ok: true, data } | { ok: false, error }`. Test coverage in matching `*.test.ts` files. Notification fan-out and Stripe wiring are marked with `PHASE 3:` comments — not silent stubs.

### UI write surfaces

- `app/admin/projects/page.tsx` — adds "New project" dialog + per-row "Edit" link.
- `app/admin/projects/[id]/page.tsx` — edit form + Danger Zone delete.
- `app/portal/settings/page.tsx` — convert read-only display to profile update form.
- `components/admin/{NewProjectDialog,EditProjectForm,DeleteProjectButton}.tsx`
- `components/portal/SettingsForm.tsx`

### Hygiene

- Deleted legacy Vercel envs `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (zero refs in repo). Documented in `.agent/vercel-envs-cleanup.md`.
- Deleted redundant root `.cmd` operator scripts: `push-csp-fix.cmd`, `push-vercel-lockfile-fix.cmd`, `fix-lockfile-and-deploy.cmd`, `ship-everything.cmd`.

### Required code surgery (necessary side-effect of the reconciliation migration)

The reconciliation migration dropped `public.messages`. To keep the portal from runtime-failing:
- Deleted `app/portal/messages/page.tsx`.
- Removed the "Messages" nav item from `app/portal/layout.tsx`.
- Removed the unread-messages tile from `app/portal/page.tsx` dashboard.
- Updated `lib/database.types.ts` (drop `messages`, add `work_orders` + `work_order_attachments`, add `invoices.hosted_invoice_url`).

A "Tickets" nav entry replaces Messages in Phase 3 when the work-order UI ships.

## Phase 3 readiness checklist

Hard blockers before Phase 3 can start:

| Item | State |
|---|---|
| `STRIPE_SECRET_KEY` (live) | ✅ set in `.env.local` and Vercel (already used by lead capture path) |
| `STRIPE_WEBHOOK_SECRET` | ✅ set (`whsec_*`) — used by `/api/webhooks/stripe` (to be authored) |
| Stripe customer mapping for portal users | ⚠️ not designed yet — needs decision on `profiles.stripe_customer_id` vs lazy creation |
| `RESEND_API_KEY` + verified sending domain DKIM/SPF for `dobeu.net` | ✅ key set; **verify DKIM/SPF before relying on quote/status emails at volume** |
| `lib/stripe.ts` server client | ⏳ Phase 3 |
| `/api/webhooks/stripe` handler + signature verification | ⏳ Phase 3 |
| Work-order UI (`/portal/tickets`, `/admin/tickets`) | ⏳ Phase 3 |
| Wire Resend admin notification on `submitWorkOrder` | ⏳ Phase 3 (TODO marker in action) |
| Datadog log drain hookup (Vercel → Datadog) | ⏳ Phase 3 |
| Intercom HMAC server-side signing (Phase 4) | ⚠️ HMAC secret not yet provisioned |
| Legacy `db-dobeutech-unified` data cutover | 🛑 Gated on inventory; deliberately not started this commit |

## Remaining Phases (4 + 5 + legacy cutover + close-out)

> Phase 3 has since shipped and is **live on `https://dobeu.net`** (HEAD `4cc72f2`):
> `lib/stripe.ts`, `/api/webhooks/stripe`, `profiles.stripe_customer_id`,
> Resend wire-up, `/portal/tickets` + `/admin/tickets`, admin invoices write
> surface. Two stale notes corrected during the remaining-phases review:
> **CI already runs `pnpm test:ci`** (`.github/workflows/ci.yml`), and the
> Intercom `user_hash` plumbing already exists end-to-end (only server-side
> HMAC signing + the env var are missing).

Design + plan for everything after Phase 3 now live in:

- **Design:** [`docs/superpowers/specs/2026-06-05-remaining-phases-design.md`](docs/superpowers/specs/2026-06-05-remaining-phases-design.md) — current-state audit, three sequencing approaches (recommends **B: parallel streams**), Phase 4 (TOTP MFA + Intercom HMAC) architecture, legacy-cutover design, Phase 5 scope, parallel-execution map, decision gates, success criteria.
- **Plan:** [`docs/superpowers/plans/2026-06-05-remaining-phases.md`](docs/superpowers/plans/2026-06-05-remaining-phases.md) — bite-sized, TDD, exact-path task groups A–H (MFA, Intercom HMAC, legacy cutover, CI/E2E, dead-code/hygiene, a11y/perf, operational close-out, parallel dispatch map).

**Headline:** ~3–4 days of agent work (4 parallel wave-1 agents) + the user's
inventory/cutover window. Only blocking human action: running the read-only
inventory queries in `.agent/migration/inventory.md`. Decision gates are
defaulted (drop `is_admin` now, keep `start-dev`/`deploy-vercel` `.cmd`s,
rate-limit accepted-risk, drop dangling `analytics-server` reference).

## Verification

All five gates green at end of Phase 2:

```
pnpm install        # baseline
pnpm type-check     # ✅
pnpm lint           # ✅ no warnings
pnpm test:ci        # ✅ 178 tests across 18 files (51 new in lib/actions/)
pnpm build          # ✅ + strict-build (no blocked warnings)
```
