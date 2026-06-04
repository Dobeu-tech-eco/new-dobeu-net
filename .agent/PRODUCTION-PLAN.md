# dobeu.net — Production Plan v2 (LOCKED)

**Date:** 2026-06-04
**Branch:** `test/coverage` (base commit `2a80db8` — build hardening)
**Status:** Decisions locked by Jeremy. This supersedes `PLAN.md` (which described the original greenfield build, now shipped).
**Scope of this doc:** Take the production-grade marketing/lead site from "read-only scaffolds" to a fully transactional portal + admin with Stripe-hosted invoicing and a new client-driven work-order ticketing system, on a single Vercel-hosted Supabase.

---

## 1. Executive summary

The marketing landing + lead pipeline is production-grade and live. The gap is that **every `/admin/*` and `/portal/*` page is read-only** — no create/edit/delete/upload/send flow exists anywhere — and Stripe is installed with live keys but **zero Stripe code**. Two P0 blockers (a `??` env guard that throws on Vercel's empty-string injection, and schema drift between the live `db-dobeutech-unified` DB and the documented-but-unapplied migration) must clear before anything else.

**Locked decisions (verbatim intent):**

| # | Decision | Resolution |
|---|---|---|
| 1 | Schema | Migrate `db-dobeutech-unified` → Vercel-managed Supabase. Legacy is the source of truth until cutover; one-way cutover; retire legacy after a 7-day soak. |
| 2 | Launch bar | Phased. Marketing/lead-capture already ships; pay-an-invoice flow is Phase 3 (second), not on the first-cutover critical path, but non-negotiable for the broader plan. |
| 3 | Stripe model | **Stripe-hosted invoicing.** Admin clicks "Create Stripe Invoice"; we store `stripe_invoice_id` + `hosted_invoice_url`; Stripe sends the pay link; `/api/webhooks/stripe` flips local status. No custom invoice-builder UI. |
| 4 | Messaging | Drop `messages` table + `/portal/messages`. Intercom owns chat. Add a **work-order ticketing system** (the headline new feature). |
| 5 | File uploads | Client uploads are **scoped to work-order submissions only** (`work_order_attachments`). Admin still uploads deliverables to `project_files` independently. |
| 6 | Admin set | Single admin `jeremyw@dobeu.net`. **`ADMIN_EMAILS` is the only source of truth**; drop the `profiles.is_admin` DB mirror. Expandable later by editing one env var. |

**Verdict:** No architectural rewrite needed. Stay on Supabase (Auth0 stays dead). Ship in **5 phases (~21–31 working days)**: P0 + DB migration → server-action foundation + portal/admin CRUD + work-order schema → Stripe invoicing + work-order UI end-to-end → auth hardening → polish.

**Path to launch:** Phase 1 unblocks production correctness and consolidates the database. Phase 2 makes the app actually mutable. Phase 3 delivers the two revenue/product features (payments + work orders). Phases 4–5 harden and polish.

---

## 2. State of the system

| Area | State | Action |
|---|---|---|
| Marketing landing | Production-grade, live | None |
| Lead pipeline (Calendly + Typeform + Apollo + Customer.io + Resend) | Solid, `processLead()` fan-out | Drop `LEAD_TABLES` probe (Phase 1) |
| `/admin/*` | Read-only list scaffolds (query Supabase, no mutations) | Add CRUD (Phase 2–3) |
| `/portal/*` | Read-only | Add mutations + tickets (Phase 2–3) |
| Stripe | Pkg installed, **live keys idle in `.env.local`**, zero code | Build hosted invoicing (Phase 3) |
| Webhooks | Calendly ✅; **Stripe, Resend-bounce, Apollo missing** | Stripe (Phase 3); others (Phase 5/backlog) |
| `lib/analytics-server.ts` | Referenced, **does not exist** | Create or remove the reference (Phase 2) |
| P0 — `NEXT_PUBLIC_SITE_URL` | `??` guard throws on empty-string env; sitemap/robots emit localhost | Fix guard + reconcile 20 Vercel envs (Phase 1) |
| P0 — Schema drift | `20260521000000_initial_schema.sql` never applied to live DB; `lib/leads.ts` probes 3 table names | DB migration + lock-in (Phase 1) |
| Build hardening | Node `20.x` pinned, `.nvmrc`, OG edge dropped, `strict-build.mjs` gating | Done (`2a80db8`) |
| Auth | Supabase magic-link; admin gate = `ADMIN_EMAILS` in `lib/utils.ts` + duplicated in middleware | Consolidate; add TOTP MFA + Intercom HMAC (Phase 4) |

---

## 3. Multi-lens review

**CEO lens.** The product story tightens: the site already converts visitors → leads; this plan closes the loop so a lead becomes a paying, serviced client without leaving the portal. The **work-order system is the strategic addition** — it turns a passive "download your files" portal into an active intake channel ("Create a Logo," "Update webpage," "Export Data") that generates new billable work from existing clients. That's expansion revenue with near-zero CAC. Payments-second is the right call: you can onboard clients and take work orders before the Stripe flow is wired, then monetize. Risk to watch: scope. The work-order system is deliberately minimal (quote → accept → invoice), not a full PM tool.

**Design lens.** The work-order detail page should read as a **conversation-style status timeline** (open → quoted → accepted → in progress → delivered), not a form dump. Reuse the existing portal shell (sidebar, cards, sonner toasts, indigo/amber tokens). The "accept quote" moment is the emotional peak — make it a single confident button with the amount rendered via `formatCurrency`. Empty states matter (no tickets yet → a friendly "Need something? Submit a request" CTA). Replace the Messages nav item with **Tickets** (swap `MessagesSquare` for a `Ticket`/`ClipboardList` icon). Keep Intercom as the floating widget for ad-hoc chat.

**DevEx lens.** Standardize on **Server Actions as the only mutation path** (per CLAUDE.md "no client-side Supabase writes"). One pattern: `"use server"` action → Zod validation → `createClient()` (RLS, user-scoped) for client actions or `createAdminClient()` for admin actions → `revalidatePath`. Centralize the admin gate so middleware and server actions share one `isAdminEmail`/`requireAdmin` helper. Delete the `LEAD_TABLES` loop so the data layer is honest about where rows go.

**Eng lens.** The dangerous patterns today are **silent fallbacks that mask errors**: the `LEAD_TABLES` 3-name probe and `admin/bookings` falling back to `leads` both hide a misconfigured/unmigrated DB — exactly the failure mode that produced the schema-drift P0. Phase 1 removes them so a broken DB fails loudly. The file-download route relies on RLS implicitly with no explicit auth assertion; add an explicit `requireUser()` so the security boundary is visible in code, not just in policy. New work-order tables get RLS from day one; admin access flows through the service-role client (never RLS), consistent with the existing admin pattern.

---

## 4. Auth0 recommendation (STAY)

**Stay on Supabase Auth.** The user deliberately migrated off Auth0 to eliminate its cost, and nothing in this scope needs Auth0's enterprise features. The cheaper, sufficient hardening is: (a) enable **Supabase TOTP MFA** for the single admin account, and (b) turn on **Intercom Identity Verification (HMAC)** so the support widget can't be spoofed. Both are Phase 4, ~1–2 days total, $0 added cost. **Revisit Auth0 only if** one of these triggers fires: (1) you need SSO/SAML for enterprise clients, (2) you onboard a team/multi-tenant model with role hierarchies beyond single-admin, or (3) compliance (SOC 2 / HIPAA) demands a managed IdP with audit logging Supabase can't satisfy. Until then, Auth0 migration work is explicitly **out of scope**.

---

## 5. Phased roadmap (LOCKED)

Effort key: **S** ≈ ≤0.5 day, **M** ≈ 0.5–1.5 days, **L** ≈ 2–4 days.

### Phase 1 — P0 blockers + DB migration + schema lock-in (~5–7 days)

| Item | Files | Effort |
|---|---|---|
| Fix `NEXT_PUBLIC_SITE_URL` empty-string guard | `app/layout.tsx:19`, `app/sitemap.ts`, `app/robots.ts` | S |
| Reconcile 20 `NEXT_PUBLIC_*` Vercel envs (delete sensitive-typed, re-add plaintext) | Vercel dashboard / `vercel env` | M |
| **Full DB migration** `db-dobeutech-unified` → Vercel Supabase (see §6) | `supabase/migrations/*`, operator runbook | L |
| Apply `20260521000000_initial_schema.sql` to target + new reconciliation migration | `supabase/migrations/` | M |
| Drop `LEAD_TABLES` probe — write directly to `leads` | `lib/leads.ts:33,48,97,100` | S |
| Remove `admin/bookings` fallback-to-leads | `app/admin/bookings/page.tsx:11-30` | S |
| Drop `profiles.is_admin` mirror; `ADMIN_EMAILS` is sole source of truth | migration + `handle_new_user()` trigger + RLS that referenced `is_admin` | M |
| **Create work-order tables + RLS now** (so Phase 2/3 UI has a target) | new migration (see §7.1–7.2) | M |
| Regenerate types | `lib/database.types.ts` (`pnpm db:types`) | S |
| `pnpm verify` green on target DB | — | S |

**Exit gate:** target DB holds all legacy data (row counts match), `pnpm verify` green, a real lead submit lands in `leads` on the target, sitemap/robots emit `https://dobeu.net`. Legacy DB set read-only and kept live for soak.

> **Note on `profiles.is_admin`:** dropping the *gate* (env is authoritative) does not require dropping the *column* immediately — but the RLS policies that reference `is_admin` must be rewritten, because admin reads already flow through `createAdminClient()` (service role, bypasses RLS). Simplest: keep RLS as "users see own rows" only, and let the service-role client be the admin path. The `handle_new_user()` trigger's `is_admin` computation becomes dead and is removed.

### Phase 2 — Server-action foundation + portal/admin core CRUD + work-order schema/RLS deployed (~5–7 days)

| Item | Files | Effort |
|---|---|---|
| Establish canonical Server Action pattern (Zod + `createClient`/`createAdminClient` + `revalidatePath`) | `lib/actions/` (new), CLAUDE.md note | M |
| Consolidate admin gate: single `requireAdmin()`/`isAdminEmail` used by middleware + actions | `lib/utils.ts`, `lib/supabase/middleware.ts` | S |
| Add explicit auth to file download | `app/api/files/[id]/download/route.ts` | S |
| Create `lib/analytics-server.ts` (or delete the dangling reference) | `lib/analytics-server.ts` | S |
| Portal CRUD: project view real data, file download hardened, settings update (name/notification prefs) | `app/portal/*`, `lib/actions/profile.ts` | M |
| Admin CRUD: create/edit project, create user (invite), edit user, upload deliverable to `project_files` | `app/admin/users/*`, `app/admin/projects/*`, `lib/actions/{projects,users,files}.ts` | L |
| **Deploy work-order schema + RLS** (already created in P1; verify + wire types) | `lib/database.types.ts` | S |
| Replace portal `Messages` nav with `Tickets`; drop `app/portal/messages`; drop `messages` table | `app/portal/layout.tsx:30`, migration | S |
| Hoist duplicated `intercomNameFromUser` into a shared util | `lib/intercom.ts` or `lib/utils.ts` (used by `app/{admin,portal}/layout.tsx`) | S |

**Exit gate:** admin can create a project and upload a deliverable; client sees + downloads it; all mutations go through server actions; work-order tables live with RLS verified by a cross-tenant test (a second user cannot read another's tickets).

### Phase 3 — Stripe-hosted invoicing + work-order UI end-to-end + observability (~7–10 days)

| Item | Files | Effort |
|---|---|---|
| `lib/stripe.ts` server client (live keys from env) | `lib/stripe.ts` (new) | S |
| Admin "Create Stripe Invoice" action → Stripe API → store `stripe_invoice_id` + `hosted_invoice_url` | `lib/actions/invoices.ts`, `app/admin/invoices/*` | M |
| Add `hosted_invoice_url` column to `invoices` | migration | S |
| `/api/webhooks/stripe` — verify signature; handle `invoice.paid`, `invoice.payment_failed`, `invoice.finalized` → flip `invoices.status` | `app/api/webhooks/stripe/route.ts` (new) | M |
| Portal invoices: "Pay" → `hosted_invoice_url` (Stripe-hosted page) | `app/portal/invoices/*` | S |
| **Work-order UI — client:** `/portal/tickets` (list + create modal w/ upload), `/portal/tickets/[id]` (timeline, files, accept-quote) | `app/portal/tickets/*` | L |
| **Work-order UI — admin:** `/admin/tickets` (list + status filter), `/admin/tickets/[id]` (quote form, status transitions, "Create Stripe Invoice") | `app/admin/tickets/*` | L |
| Work-order server actions: `submitWorkOrder`, `quoteWorkOrder`, `acceptWorkOrderQuote`, `updateWorkOrderStatus` (see §7.4) | `lib/actions/work-orders.ts` | M |
| Storage bucket `work-order-attachments` + signed-URL upload flow | migration + `lib/actions/work-orders.ts` | M |
| **Linkage:** `acceptWorkOrderQuote` → admin queue → "Create Stripe Invoice" sets `work_orders.invoice_id` | `lib/actions/{work-orders,invoices}.ts` | M |
| Notifications: create → Resend admin + Intercom `work_order_created`; transitions → Resend client | `lib/leads.ts` patterns reused, `lib/actions/work-orders.ts` | M |
| Observability: Datadog Log Drain hookup + Stripe webhook error alerting | `lib/datadog.ts`, Vercel/Datadog config | S |

**Exit gate:** end-to-end — client submits a work order with a file → admin quotes it → client accepts → admin creates a Stripe invoice → client pays via Stripe-hosted page → webhook flips status to `paid` → both portal and admin reflect it. Stripe in test mode first, then live-key smoke with a $1 invoice.

### Phase 4 — Auth hardening (~1–2 days)

| Item | Files | Effort |
|---|---|---|
| Enable Supabase TOTP MFA for admin; enforce on `/admin/*` | Supabase dashboard + `app/admin/layout.tsx` MFA assurance check | M |
| Intercom Identity Verification (HMAC) | `lib/intercom.ts`, `components/portal/IntercomIdentify.tsx`, `INTERCOM_SECRET` env | S |
| Replace in-memory rate-limit fallback with Upstash (or document accepted risk) | `app/api/lead/route.ts` | S |

**Exit gate:** admin login requires TOTP; Intercom rejects unsigned identify; rate-limit is durable across instances.

### Phase 5 — Polish (~3–5 days)

| Item | Files | Effort |
|---|---|---|
| Perf back to Lighthouse ≥90 (lazy-load embeds, bundle check) | landing + portal | M |
| Test coverage: server actions, webhook handlers, RLS, work-order state machine | `*.test.ts` | L |
| Make CI run tests (`pnpm test:ci` in `.github/workflows/ci.yml`) | CI config | S |
| a11y pass (axe + keyboard) on new ticket UIs | `app/{portal,admin}/tickets/*` | M |
| Dead-code cleanup (8 unwired `lib/*` exports, 13/16 root `.cmd` scripts) | repo root, `lib/*` | S |
| Missing webhooks: Resend bounce, Apollo (if still wanted) | `app/api/webhooks/*` | M |

**Exit gate:** `pnpm verify` green, CI runs tests, Lighthouse targets met, dead code removed.

---

## 6. Database migration strategy (Design Task A)

**Recommendation: one-shot dump + restore with brief downtime (option a).** Rationale: single operator, low write volume, presumably <10k rows total. A dual-write window or watermark sync adds code and reconciliation complexity that this scale doesn't justify, and the only live writer is `processLead()` plus the Calendly webhook — both pausable for a short maintenance window. Legacy stays **read-only and live for 7 days** as the rollback.

### 6.1 Inventory step

Connect to legacy `db-dobeutech-unified` (Supabase Studio SQL editor, or `psql "$LEGACY_DATABASE_URL"`).

Enumerate tables + row counts:
```sql
-- All user tables in public schema
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;

-- Row counts per table (run after the list above)
select schemaname, relname as table, n_live_tup as approx_rows
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc;
```

Exact column schema per table (repeat per table, or query all at once):
```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

Confirm the three lead-candidate tables from `lib/leads.ts` (`leads`, `dobeu_net_leads`, `contact_submissions`) and capture their exact shapes:
```sql
select to_regclass('public.leads'),
       to_regclass('public.dobeu_net_leads'),
       to_regclass('public.contact_submissions');
```

Dump structure-only for diffing against the target migration:
```bash
pg_dump "$LEGACY_DATABASE_URL" --schema-only --no-owner --no-privileges \
  -n public > legacy-schema.sql
```

Produce an inventory artifact (`.agent/migration/inventory.md`) listing every legacy table, its row count, and its target mapping (next step) before touching the target.

### 6.2 Mapping plan

| Legacy table (likely) | → Target | Field-level notes / transforms |
|---|---|---|
| `contact_submissions` | `leads` | Map `email`/`name`/`company`; coalesce a `source` (`'form'` default); fold extra columns into `raw_payload` jsonb; set `first_seen`/`last_seen` from legacy `created_at` (cast to `timestamptz`). |
| `dobeu_net_leads` | `leads` | Same as above; if both legacy lead tables exist, **dedupe by email**, keeping the most recent `last_seen`. Preserve `apollo_contact_id` if present. |
| `leads` (legacy) | `leads` | Direct column copy where names align; map any legacy `utm` JSON blob into the five discrete `utm_*` columns; remainder → `raw_payload`. |
| legacy `client_files` | `project_files` | Map `storage_path`/`filename`/`mime`/`size_bytes`; resolve `project_id` FK (join on legacy project key); set `uploaded_by` to admin uuid if legacy lacks it; default `retention_until = uploaded_at + 3 years`. **Move/copy the actual storage objects** into the target `project-files` bucket (Storage migration is separate from row migration — see 6.3 step 4). |
| legacy `users` | `auth.users` + `profiles` | Cannot bulk-insert into `auth.users` directly; use Supabase Admin API (`auth.admin.createUser`) or the GoTrue import. Then `profiles` rows auto-create via `handle_new_user()` (or insert manually). Map `full_name`, `company`, `apollo_contact_id`. **Passwords don't carry** — clients re-verify via magic link (acceptable; communicate before cutover). |
| legacy `projects` | `projects` | Map `title`/`description`/`status` (normalize legacy status strings → `project_status` enum); `owner_user_id` re-pointed to migrated `auth.users.id`; `total_cents`/`stripe_link` if present. |
| legacy `invoices` | `invoices` | Map `amount_cents`/`currency`/`status` (→ `invoice_status` enum); carry `stripe_invoice_id`/`stripe_payment_intent`; add new `hosted_invoice_url` (Phase 3) nullable. |
| legacy `bookings` | `bookings` | Map `scheduled_at`/`email`/`name`/`status` (→ `booking_status`); carry `apollo_meeting_id`/`google_event_id`. |
| legacy `messages` (if any) | **drop** | Decision 4 — Intercom replaces messaging. Do not migrate. |
| legacy analytics/events | `page_events` | Best-effort; map `event_name`/`properties`/`page_path`/`occurred_at`. Low value — migrate only if cheap. |

**ID strategy:** generate a `uuid` map for legacy primary keys so FKs (`projects.owner_user_id`, `invoices.project_id`, `project_files.project_id`) resolve consistently. Keep the map in a temp table for the duration of the migration.

### 6.3 Cutover strategy (one-shot)

1. **Freeze writes:** pause the Calendly webhook (disable in Calendly) and put `/api/lead` into a short maintenance mode (or accept the ~30-min gap). Snapshot legacy with `pg_dump`.
2. **Apply target schema:** run `20260521000000_initial_schema.sql` + the new reconciliation migration (drops `messages`, adds work-order tables, removes `is_admin` RLS dependence, adds `hosted_invoice_url`) against the Vercel Supabase target.
3. **Restore + transform:** restore legacy data into a *staging schema* on the target (`pg_restore`/`psql` into `legacy_import`), then run mapping SQL (`insert into public.X select ... from legacy_import.Y`) with the transforms from 6.2. Run `auth.users` import via Admin API for the `users` table.
4. **Migrate storage objects:** copy files from the legacy storage bucket to the target `project-files` bucket (Supabase Storage move via the Storage API or `supabase storage cp`); verify `project_files.storage_path` values resolve.
5. **Verify (6.5 pre-cutover gates).**
6. **Swap env on Vercel:** point `NEXT_PUBLIC_VERCEL_SUPABASE_URL` / `*_ANON_KEY` / `VERCEL_SUPABASE_URL` / `VERCEL_SUPABASE_SERVICE_ROLE_KEY` at the target (these are auto-provisioned by the Vercel Supabase integration, so this may already be the target — confirm).
7. **Redeploy** and run cutover smoke (6.5).
8. **Re-enable** the Calendly webhook + `/api/lead`.
9. **Soak 24h**, then begin the 7-day legacy read-only retention before retirement.

### 6.4 Code changes (part of Phase 1)

- Delete the `LEAD_TABLES` constant and the `for (const table of LEAD_TABLES)` loop in `lib/leads.ts`; write directly to `leads`; surface insert errors (no silent swallow).
- Remove the fallback-to-`leads` branch in `app/admin/bookings/page.tsx` — render the bookings empty state on error instead of masking it.
- Rewrite RLS policies that reference `profiles.is_admin` (admin reads already use the service-role client). Keep user-scoped `select`/`insert`/`update` policies.
- Validate `handle_new_user()` works on the target (profile row auto-creates on signup); remove its now-dead `is_admin` computation.

### 6.5 Verification gates

- **Before cutover:** per-table row counts on target == legacy (allowing for documented dedupe on leads); `legacy-schema.sql` diff reviewed; target `pnpm build` green against target env; storage object counts match.
- **At cutover:** Vercel env points at target; landing, `/portal`, `/admin` all render; a real lead submit lands in `leads`; magic-link login works for one migrated user; one project + its files visible in portal.
- **After cutover:** 24h watch (error logs, lead inserts, no 500s on portal/admin); then retire legacy DB at day 7.

### 6.6 Rollback plan

Keep legacy DB **read-only but live for 7 days**. Rollback = revert the four Supabase env vars on Vercel to the legacy connection and redeploy. Because cutover is one-shot with frozen writes, no data diverges during the window, so rollback is lossless within the soak period.

---

## 7. Work-order ticketing system design (Design Task B)

The headline new feature. Replaces in-portal messaging with a structured intake → quote → accept → deliver → invoice flow. Tables created in Phase 1; UI + actions in Phase 3.

### 7.1 Schema (new migration)

```sql
create type work_order_service_type as enum (
  'logo', 'website_update', 'data_export', 'consulting', 'other'
);
create type work_order_status as enum (
  'open', 'quoted', 'accepted', 'in_progress', 'delivered', 'closed', 'cancelled'
);
create type work_order_priority as enum ('low', 'normal', 'high');

create table public.work_orders (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,  -- nullable: orphan tickets allowed
  service_type work_order_service_type not null,
  title text not null,
  description text,
  status work_order_status not null default 'open',
  priority work_order_priority not null default 'normal',  -- admin-settable
  quoted_amount_cents integer,
  quoted_at timestamptz,
  accepted_at timestamptz,           -- client confirms quote → triggers Stripe invoice creation (Phase 3)
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index work_orders_created_by_idx on public.work_orders(created_by);
create index work_orders_status_idx on public.work_orders(status);
create index work_orders_project_idx on public.work_orders(project_id);

create trigger work_orders_updated_at before update on public.work_orders
  for each row execute function public.set_updated_at();

create table public.work_order_attachments (
  id uuid primary key default uuid_generate_v4(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

create index work_order_attachments_wo_idx on public.work_order_attachments(work_order_id);
```

### 7.2 RLS policies

Admin access is **not** via RLS — it flows through `createAdminClient()` (service role, bypasses RLS), consistent with the rest of the app. RLS only constrains the client (anon/authed) path.

```sql
alter table public.work_orders enable row level security;
alter table public.work_order_attachments enable row level security;

-- Clients: read own
create policy "wo_select_own" on public.work_orders
  for select using (created_by = auth.uid());

-- Clients: create own
create policy "wo_insert_own" on public.work_orders
  for insert with check (created_by = auth.uid());

-- Clients: update own ONLY when quoted, and only to accept.
-- (Column-level "only accepted_at" is enforced in the server action; RLS gates the row + status.)
create policy "wo_update_accept_quote" on public.work_orders
  for update using (created_by = auth.uid() and status = 'quoted')
  with check (created_by = auth.uid());

-- Attachments: read/insert own (scoped through the parent work order)
create policy "wo_att_select_own" on public.work_order_attachments
  for select using (
    exists (select 1 from public.work_orders w
            where w.id = work_order_attachments.work_order_id and w.created_by = auth.uid())
  );

create policy "wo_att_insert_own" on public.work_order_attachments
  for insert with check (
    exists (select 1 from public.work_orders w
            where w.id = work_order_attachments.work_order_id and w.created_by = auth.uid())
  );
```

> RLS can gate *which rows* and *which status* a client may update, but not *which columns*. The `acceptWorkOrderQuote` server action is the only client write path for updates and sets only `status='accepted'` + `accepted_at` — so column-level intent is enforced in code, RLS enforces ownership + the `quoted` precondition as defense-in-depth.

### 7.3 Storage

- Bucket: **`work-order-attachments`** (private), created in the Phase 1 migration.
- RLS scoped so an object is readable/writable only when its path maps to a `work_orders` row with `created_by = auth.uid()` (mirror the `project-files` storage policies, swapping the join table). Admin read/write via service role.
- **Max file size 25 MB** (enforce in the server action before issuing the signed upload URL, and via bucket file-size limit).
- **Allowed MIME types:** images (`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/svg+xml`), PDFs (`application/pdf`), common docs (`.docx`, `.xlsx`, `.pptx`, `text/plain`, `text/csv`). **Reject executables** and unknown binary types (`application/x-msdownload`, `application/x-sh`, etc.) — validate by MIME + extension allowlist in the action.

### 7.4 Server actions (canonical mutation pattern)

All in `lib/actions/work-orders.ts`, `"use server"`, Zod-validated, `revalidatePath` after mutation.

- **`submitWorkOrder({ service_type, title, description, files[] })`** — *client.* Uses `createClient()` (RLS). Inserts `work_orders` row (`created_by = auth.uid()`, `status='open'`), then for each file: validate size/MIME, request a signed upload URL for `work-order-attachments`, upload, insert `work_order_attachments` row. Fires notifications (§7.6).
- **`quoteWorkOrder({ id, amount_cents })`** — *admin.* Uses `createAdminClient()` after `requireAdmin()`. Sets `status='quoted'`, `quoted_amount_cents`, `quoted_at = now()`. Sends Resend "you've been quoted" email to client.
- **`acceptWorkOrderQuote({ id })`** — *client.* Uses `createClient()` (RLS gate: own row + `status='quoted'`). Sets `status='accepted'`, `accepted_at = now()`. In Phase 3, enqueues the order for admin Stripe-invoice creation (no auto-charge — admin clicks "Create Stripe Invoice").
- **`updateWorkOrderStatus({ id, status })`** — *admin.* Uses `createAdminClient()` after `requireAdmin()`. Validates the transition against the state machine (open→quoted→accepted→in_progress→delivered→closed; cancelled reachable from any non-terminal state). Sends Resend status-update email to client.

State machine (enforced in actions):
```
open → quoted → accepted → in_progress → delivered → closed
  └──────┴──────────┴───────────┴────────────┴──→ cancelled
```

### 7.5 UI surfaces

**Client portal**
- `/portal/tickets` — list of own tickets (status badge, service type, quoted amount, created date) + "New request" button opening a create modal (service-type dropdown, title, description, drag-drop file upload).
- `/portal/tickets/[id]` — detail: conversation-style **status timeline**, attachment list (signed-URL downloads), and an **Accept Quote** button (rendering the amount via `formatCurrency`) shown only when `status='quoted'`.
- Sidebar: replace **Messages** (`MessagesSquare`) with **Tickets** (`ClipboardList`/`Ticket` icon) in `app/portal/layout.tsx`.

**Admin**
- `/admin/tickets` — all tickets, filter by status, sortable; columns: client, service type, status, priority, quoted amount, age.
- `/admin/tickets/[id]` — detail with: **quote form** (amount → `quoteWorkOrder`), **status transition** controls (`updateWorkOrderStatus`), priority setter, attachment viewer, and a **"Create Stripe Invoice"** button enabled once `status='accepted'` (sets `work_orders.invoice_id`, creates the Stripe hosted invoice — §5 Phase 3 linkage).

### 7.6 Notifications

- **On create** (`submitWorkOrder`): Resend email to admin (`RESEND_REPLY_TO`) + Intercom event `work_order_created`. Customer.io optional.
- **On quote / status transition:** Resend email to the client (reuse the `lib/leads.ts` Resend + `escapeHtml` template helpers). 
- Keep all notification sends best-effort/non-fatal (same discipline as `processLead`).

### 7.7 Phase placement

- **Tables + RLS + storage bucket:** Phase 1 (during schema reconciliation) so the target is ready.
- **Server actions + client UI + admin UI + Stripe linkage:** Phase 3 (depends on the Phase 2 server-action foundation + file-upload plumbing, and integrates with Stripe invoice creation).

---

## 8. Quick wins (from the code-quality audit)

4 MEDIUM ship-blockers (do in Phase 1–2) + simplifications:

1. **Lead-table loop masks errors** → drop `LEAD_TABLES`, write to `leads`, surface errors (Phase 1). *(M ship-blocker)*
2. **Missing explicit auth on `/api/files/[id]/download`** → add `requireUser()` assertion, don't rely on RLS implicitly (Phase 2). *(M ship-blocker)*
3. **In-memory rate-limit fallback** → Upstash or documented accepted risk (Phase 4). *(M ship-blocker)*
4. **Admin-email parsing duplicated** (`isAdminEmail` + middleware) → single shared helper (Phase 2). *(M ship-blocker)*
5. Drop `LEAD_TABLES` (covered by #1).
6. Hoist duplicated `intercomNameFromUser` (`app/admin/layout.tsx` + `app/portal/layout.tsx`) into a shared util (Phase 2).
7. Delete 13/16 root `.cmd` operator scripts (keep `push-vercel-lockfile-fix`, `fix-lockfile-and-deploy`, `push-csp-fix`) (Phase 5).
8. Remove 8 tested-but-unwired `lib/*` exports (Phase 5).
9. Remove `admin/bookings` fallback (covered in Phase 1).
10. Create or delete the dangling `lib/analytics-server.ts` reference (Phase 2).
11. Drop `profiles.is_admin` mirror; `ADMIN_EMAILS` sole source of truth (Phase 1).

---

## 9. Open low-stakes follow-ups (non-gating)

- **Domain cutover timing:** if the Vercel envs already point at the new Supabase, the "swap" in §6.3 step 6 is a no-op — confirm which Supabase the live deployment currently reads. (Affects only the migration runbook, not the design.)
- **Resend sending domain DKIM/SPF:** verify `dobeu.net` is a verified Resend sending domain before relying on work-order/quote emails at volume (otherwise they land in spam).
- **Datadog Log Drain:** hook Vercel → Datadog log drain in Phase 3 for Stripe-webhook error visibility (`lib/datadog.ts` already present).
- **Apollo / Resend-bounce webhooks:** still listed as missing; only Stripe is required for this plan. Build the other two in Phase 5 if still wanted.
- **`profiles.is_admin` column:** kept for now (only the RLS dependence + trigger logic removed); decide later whether to physically drop the column.
- **Service-type list:** starts with 5 enums; adding more later is an enum `ALTER TYPE` migration (cheap) — confirm no need for an admin-editable taxonomy table in v1.

---

## 10. Recommended execution order — first 3 actions

1. **Fix the `NEXT_PUBLIC_SITE_URL` P0 + reconcile Vercel envs.** One-line guard change in `app/layout.tsx` plus deleting/re-adding the 20 `NEXT_PUBLIC_*` entries as plaintext. This unblocks correct sitemap/robots/OG and stops the empty-string `new URL("")` throw — cheapest, highest-leverage fix.
2. **Run the legacy DB inventory (§6.1).** Connect to `db-dobeutech-unified`, dump table list + row counts + schemas to `.agent/migration/inventory.md`. You can't design the exact mapping SQL until you see the real legacy shape — this de-risks the whole migration.
3. **Author the reconciliation migration.** A single new `supabase/migrations/*.sql` that: applies on top of the initial schema, drops `messages`, removes `is_admin` RLS dependence, adds `work_orders` + `work_order_attachments` + enums + RLS + the `work-order-attachments` bucket, and adds `invoices.hosted_invoice_url`. This makes the target schema final before any data lands, so the one-shot cutover restores into a stable target.

After these, proceed through Phase 1's code changes (drop `LEAD_TABLES`, remove the bookings fallback) and the full one-shot cutover.
