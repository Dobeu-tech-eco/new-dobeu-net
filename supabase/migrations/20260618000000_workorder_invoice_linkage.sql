-- =============================================================================
-- dobeu.net v3 — work-order / invoice linkage (Phase 3 close-out)
-- =============================================================================
-- Closes the P0 revenue gap: lets an admin issue a Stripe invoice for an
-- accepted work order that has NO project, while keeping the invoice visible
-- to (and payable by) the owning client under RLS.
--
-- Idempotent: every change is guarded (`if not exists` / `do $$`).
--
-- -----------------------------------------------------------------------------
-- CENTRAL TYPE-RECONCILIATION NOTES (orchestrator must regenerate
-- lib/database.types.ts — `pnpm db:types`). EXACT changes:
--
--   public.invoices
--     - project_id : uuid NOT NULL  ->  uuid NULL          (now nullable)
--     - user_id    : NEW column     uuid NULL references auth.users(id)
--
--   public.work_orders
--     - in_progress_at : NEW column timestamptz NULL
--     - delivered_at   : NEW column timestamptz NULL
--     - closed_at      : NEW column timestamptz NULL
--     - cancelled_at   : NEW column timestamptz NULL
--
-- No other tables touched.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 1. invoices: allow project-less invoices + a direct owner column for RLS.
--    Today an invoice is owned solely via project_id -> projects.owner_user_id.
--    A project-less work-order invoice would therefore be invisible to the
--    client. Adding invoices.user_id (the work order's created_by) gives RLS a
--    direct ownership path and is the lowest-blast-radius change: existing
--    project-scoped invoices keep working unchanged.
-- =============================================================================
alter table public.invoices
  alter column project_id drop not null;

alter table public.invoices
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists invoices_user_idx on public.invoices(user_id);

comment on column public.invoices.user_id is
  'Direct owner (auth.users.id). Set for work-order invoices that may have a NULL project_id so RLS can scope client reads without a project. Project-scoped invoices may leave this NULL and rely on project_id -> projects.owner_user_id.';

-- Backfill user_id for existing project-scoped rows (best-effort; not required
-- for correctness, but keeps the ownership signal consistent going forward).
update public.invoices i
  set user_id = p.owner_user_id
  from public.projects p
  where i.project_id = p.id
    and i.user_id is null;

-- =============================================================================
-- 2. invoices RLS: extend client read to ALSO match user_id = auth.uid().
--    Leave invoices_admin_all untouched (admin reads go through service-role
--    and bypass RLS; that policy still references the dropped is_admin column
--    but is moot in practice and out of scope here).
-- =============================================================================
drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = invoices.project_id and p.owner_user_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. work_orders: per-status timestamps so the client timeline can render
--    in_progress / delivered / closed / cancelled milestones with real times.
-- =============================================================================
alter table public.work_orders
  add column if not exists in_progress_at timestamptz;

alter table public.work_orders
  add column if not exists delivered_at timestamptz;

alter table public.work_orders
  add column if not exists closed_at timestamptz;

alter table public.work_orders
  add column if not exists cancelled_at timestamptz;
