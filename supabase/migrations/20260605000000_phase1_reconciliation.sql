-- =============================================================================
-- dobeu.net v3 — Phase 1 reconciliation migration (2026-06-05) -- DRAFT
-- -----------------------------------------------------------------------------
-- Per .agent/PRODUCTION-PLAN.md §6 (DB migration) + §7 (work-order ticketing).
--
-- DRAFT STATUS: do NOT apply against the legacy `db-dobeutech-unified` database
-- yet. This migration is staged so the target (Vercel-managed) Supabase can
-- accept the legacy dump after the inventory at `.agent/migration/inventory.md`
-- is filled in and the mapping SQL is authored.
--
-- What this migration does (and why):
--   1. Drop `messages` + its RLS policies (gate-4 decision: Intercom owns chat).
--   2. Neutralize RLS policies that key off `profiles.is_admin`
--      (gate-6 decision: ADMIN_EMAILS env is the single admin source of truth;
--      admin reads already flow through `createAdminClient()` -- service role,
--      bypasses RLS). The `profiles.is_admin` *column* is kept for now -- see
--      the TODO marker below -- only the dependent policies + trigger logic
--      are removed.
--   3. Add `invoices.hosted_invoice_url` (Stripe-hosted invoicing, gate-3).
--   4. Create `work_orders` + `work_order_attachments` + their enums + RLS
--      so Phase 2/3 UI has a target. RLS gates ownership; column-level
--      "client can only accept-quote" is enforced in the server action.
--   5. Provision the private `work-order-attachments` storage bucket + RLS
--      policies. Admin path bypasses via service role.
--
-- Style: mirrors `20260521000000_initial_schema.sql`. Idempotent where cheap
-- (`if exists` / `if not exists`) so reruns during cutover prep don't fail.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Drop `messages` (Intercom replaces it). Policies fall away with the table.
-- -----------------------------------------------------------------------------
drop table if exists public.messages cascade;


-- -----------------------------------------------------------------------------
-- 2. Neutralize `profiles.is_admin`-dependent RLS.
--    Admin reads route through `createAdminClient()` (service role bypasses RLS)
--    so the column-driven policies are dead weight and risk drift against the
--    real env-driven gate (`ADMIN_EMAILS`).
--
--    Keep the user-scoped own-row policies. Drop the admin_* policies. Replace
--    the previously broad `profiles_admin_all` policy with nothing -- nobody
--    queries `profiles` from the RLS path as an admin (it would go via service
--    role).
-- -----------------------------------------------------------------------------
drop policy if exists "profiles_admin_all"       on public.profiles;
drop policy if exists "projects_admin_all"       on public.projects;
drop policy if exists "project_files_admin_all"  on public.project_files;
drop policy if exists "invoices_admin_all"       on public.invoices;
drop policy if exists "leads_admin_select"       on public.leads;
drop policy if exists "leads_admin_update"       on public.leads;
drop policy if exists "bookings_admin_all"       on public.bookings;
drop policy if exists "page_events_admin_select" on public.page_events;

-- Also drop the storage policies that gated on `profiles.is_admin`. Storage
-- access for admins flows through the service-role path going forward.
drop policy if exists "project_files_storage_select_own"   on storage.objects;
drop policy if exists "project_files_storage_admin_insert" on storage.objects;
drop policy if exists "project_files_storage_admin_delete" on storage.objects;

-- Re-add the user-scoped read policy for `project-files` storage without the
-- is_admin branch. Admin access is now exclusively service-role.
create policy "project_files_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.project_files pf
      join public.projects p on p.id = pf.project_id
      where pf.storage_path = name and p.owner_user_id = auth.uid()
    )
  );

-- Rewrite the `handle_new_user` trigger so it no longer computes `is_admin`
-- from a postgres GUC. The column keeps its default `false` and stops drifting.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. invoices.hosted_invoice_url -- Stripe-hosted invoicing (gate-3).
--    Admin's "Create Stripe Invoice" action will persist this so the portal
--    "Pay" button links straight to Stripe's hosted page.
-- -----------------------------------------------------------------------------
alter table public.invoices
  add column if not exists hosted_invoice_url text;


-- -----------------------------------------------------------------------------
-- 4. Work-order ticketing system (per production-plan §7.1, §7.2).
-- -----------------------------------------------------------------------------
do $$ begin
  create type work_order_service_type as enum (
    'logo', 'website_update', 'data_export', 'consulting', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_order_status as enum (
    'open', 'quoted', 'accepted', 'in_progress', 'delivered', 'closed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_order_priority as enum ('low', 'normal', 'high');
exception when duplicate_object then null; end $$;

create table if not exists public.work_orders (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid not null references auth.users(id) on delete cascade,
  -- Nullable: clients can submit a request before a project exists for it.
  project_id uuid references public.projects(id) on delete set null,
  service_type work_order_service_type not null,
  title text not null,
  description text,
  status work_order_status not null default 'open',
  priority work_order_priority not null default 'normal',
  quoted_amount_cents integer,
  quoted_at timestamptz,
  -- accepted_at: client confirms quote -> queues admin to create Stripe invoice
  accepted_at timestamptz,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_orders_created_by_idx on public.work_orders(created_by);
create index if not exists work_orders_status_idx     on public.work_orders(status);
create index if not exists work_orders_project_idx    on public.work_orders(project_id);

drop trigger if exists work_orders_updated_at on public.work_orders;
create trigger work_orders_updated_at
  before update on public.work_orders
  for each row execute function public.set_updated_at();

create table if not exists public.work_order_attachments (
  id uuid primary key default uuid_generate_v4(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_at timestamptz not null default now()
);

create index if not exists work_order_attachments_wo_idx
  on public.work_order_attachments(work_order_id);


-- -----------------------------------------------------------------------------
-- 4b. Work-order RLS.
--     Admin path bypasses RLS via `createAdminClient()`. RLS only gates the
--     anon/authed client path. Column-level "can only set accepted_at +
--     status='accepted'" is enforced in the `acceptWorkOrderQuote` server
--     action -- RLS provides defense-in-depth on ownership + status.
-- -----------------------------------------------------------------------------
alter table public.work_orders            enable row level security;
alter table public.work_order_attachments enable row level security;

drop policy if exists "wo_select_own"          on public.work_orders;
drop policy if exists "wo_insert_own"          on public.work_orders;
drop policy if exists "wo_update_accept_quote" on public.work_orders;

create policy "wo_select_own" on public.work_orders
  for select using (created_by = auth.uid());

create policy "wo_insert_own" on public.work_orders
  for insert with check (created_by = auth.uid());

create policy "wo_update_accept_quote" on public.work_orders
  for update using (created_by = auth.uid() and status = 'quoted')
  with check (created_by = auth.uid());

drop policy if exists "wo_att_select_own" on public.work_order_attachments;
drop policy if exists "wo_att_insert_own" on public.work_order_attachments;

create policy "wo_att_select_own" on public.work_order_attachments
  for select using (
    exists (
      select 1 from public.work_orders w
      where w.id = work_order_attachments.work_order_id
        and w.created_by = auth.uid()
    )
  );

create policy "wo_att_insert_own" on public.work_order_attachments
  for insert with check (
    exists (
      select 1 from public.work_orders w
      where w.id = work_order_attachments.work_order_id
        and w.created_by = auth.uid()
    )
  );


-- -----------------------------------------------------------------------------
-- 5. Storage bucket: `work-order-attachments` (private).
--    Per production-plan §7.3: 25 MB cap, image/PDF/common-doc MIME allowlist
--    enforced in the server action *before* a signed upload URL is issued.
--    Admin reads/writes via service-role; RLS gates client read/write to
--    objects whose `name` (storage path) belongs to a work order owned by
--    the requesting user.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('work-order-attachments', 'work-order-attachments', false)
  on conflict (id) do nothing;

drop policy if exists "wo_attachments_storage_select_own" on storage.objects;
drop policy if exists "wo_attachments_storage_insert_own" on storage.objects;
drop policy if exists "wo_attachments_storage_delete_own" on storage.objects;

create policy "wo_attachments_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'work-order-attachments'
    and exists (
      select 1 from public.work_order_attachments a
      join public.work_orders w on w.id = a.work_order_id
      where a.storage_path = name and w.created_by = auth.uid()
    )
  );

create policy "wo_attachments_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'work-order-attachments'
    and exists (
      select 1 from public.work_orders w
      where w.created_by = auth.uid()
        -- New uploads land under <work_order_id>/... by convention; enforce it
        -- so a client cannot upload into another user's namespace.
        and name like w.id::text || '/%'
    )
  );

create policy "wo_attachments_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'work-order-attachments'
    and exists (
      select 1 from public.work_order_attachments a
      join public.work_orders w on w.id = a.work_order_id
      where a.storage_path = name and w.created_by = auth.uid()
    )
  );
