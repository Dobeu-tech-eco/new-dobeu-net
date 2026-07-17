-- =============================================================================
-- Multi-tenant companies (2026-07-17)
-- Adds: companies, company_roles (extensible catalog), company_members,
--       digital_assets, asset_entitlements, admin_audit_log.
-- Scopes: nullable company_id on projects + work_orders (files/invoices
--         inherit scope through their project join).
-- RLS model: SELECT-widening only. Company members gain read visibility over
--   company-owned rows; all writes keep today's owner / service-role paths.
--   Membership checks go through SECURITY DEFINER helpers so policies on
--   company_members never recurse into themselves.
-- Additive-only: no existing column, policy, or row is modified or dropped.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. companies
-- -----------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  stripe_customer_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. company_roles — extensible catalog, not an enum. Higher rank = more
--    privilege. New employer/role types are inserted rows, no migration needed.
-- -----------------------------------------------------------------------------
create table if not exists public.company_roles (
  key text primary key,
  label text not null,
  rank integer not null,
  created_at timestamptz not null default now()
);

insert into public.company_roles (key, label, rank) values
  ('company_admin', 'Company Admin', 100),
  ('manager',       'Manager',        60),
  ('employee',      'Employee',       30),
  ('viewer',        'Viewer',         10)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 3. company_members
-- -----------------------------------------------------------------------------
create table if not exists public.company_members (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'employee' references public.company_roles(key),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_user_idx    on public.company_members(user_id);
create index if not exists company_members_company_idx on public.company_members(company_id);

drop trigger if exists company_members_updated_at on public.company_members;
create trigger company_members_updated_at
  before update on public.company_members
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Membership helpers (SECURITY DEFINER: bypass RLS inside the check so
--    company_members policies can call them without infinite recursion).
-- -----------------------------------------------------------------------------
create or replace function public.is_company_member(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = cid
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.company_role_rank(cid uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select r.rank
    from public.company_members m
    join public.company_roles r on r.key = m.role
    where m.company_id = cid
      and m.user_id = auth.uid()
      and m.status = 'active'
  ), 0);
$$;

-- -----------------------------------------------------------------------------
-- 5. digital_assets + asset_entitlements (purchased electronic assets)
-- -----------------------------------------------------------------------------
create table if not exists public.digital_assets (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  storage_path text not null,
  stripe_product_id text,
  price_cents integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_entitlements (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.digital_assets(id) on delete cascade,
  -- Exactly one grantee: a company (all members can access) or a single user.
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  source text not null default 'stripe',
  stripe_checkout_session_id text,
  granted_at timestamptz not null default now(),
  constraint asset_entitlements_grantee check (
    (company_id is not null)::int + (user_id is not null)::int = 1
  )
);

-- Idempotent webhook processing: one grant per checkout session.
create unique index if not exists asset_entitlements_session_uniq
  on public.asset_entitlements(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists asset_entitlements_company_idx on public.asset_entitlements(company_id);
create index if not exists asset_entitlements_user_idx    on public.asset_entitlements(user_id);

-- -----------------------------------------------------------------------------
-- 6. admin_audit_log — provisioning actions (service-role writes only)
-- -----------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  data jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 7. Company scope columns (nullable — personal/B2C accounts keep company_id
--    null and are untouched). project_files + invoices inherit through
--    project_id; work_order_attachments inherit through work_order_id.
-- -----------------------------------------------------------------------------
alter table public.projects    add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.work_orders add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists projects_company_idx    on public.projects(company_id);
create index if not exists work_orders_company_idx on public.work_orders(company_id);

-- -----------------------------------------------------------------------------
-- 8. RLS
-- -----------------------------------------------------------------------------
alter table public.companies          enable row level security;
alter table public.company_roles      enable row level security;
alter table public.company_members    enable row level security;
alter table public.digital_assets     enable row level security;
alter table public.asset_entitlements enable row level security;
alter table public.admin_audit_log    enable row level security;

-- companies: members can see their own company. All writes via service role.
drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member" on public.companies
  for select using (public.is_company_member(id));

-- company_roles: readable catalog for any signed-in user.
drop policy if exists "company_roles_select_authed" on public.company_roles;
create policy "company_roles_select_authed" on public.company_roles
  for select using (auth.uid() is not null);

-- company_members: co-members see the roster; only a company_admin (rank 100)
-- mutates it from the client path. Self-row always visible (covers 'invited').
drop policy if exists "company_members_select_comember" on public.company_members;
create policy "company_members_select_comember" on public.company_members
  for select using (
    user_id = auth.uid() or public.is_company_member(company_id)
  );

drop policy if exists "company_members_admin_insert" on public.company_members;
create policy "company_members_admin_insert" on public.company_members
  for insert with check (public.company_role_rank(company_id) >= 100);

drop policy if exists "company_members_admin_update" on public.company_members;
create policy "company_members_admin_update" on public.company_members
  for update using (public.company_role_rank(company_id) >= 100)
  with check (public.company_role_rank(company_id) >= 100);

drop policy if exists "company_members_admin_delete" on public.company_members;
create policy "company_members_admin_delete" on public.company_members
  for delete using (public.company_role_rank(company_id) >= 100);

-- digital_assets: signed-in users browse the active catalog.
drop policy if exists "digital_assets_select_active" on public.digital_assets;
create policy "digital_assets_select_active" on public.digital_assets
  for select using (auth.uid() is not null and active);

-- asset_entitlements: mine, or my company's.
drop policy if exists "asset_entitlements_select_entitled" on public.asset_entitlements;
create policy "asset_entitlements_select_entitled" on public.asset_entitlements
  for select using (
    user_id = auth.uid()
    or (company_id is not null and public.is_company_member(company_id))
  );

-- admin_audit_log: no client policies — service role only.

-- Company visibility widening on existing resources (SELECT only; writes keep
-- the existing owner_user_id / created_by / service-role paths).
drop policy if exists "projects_select_company" on public.projects;
create policy "projects_select_company" on public.projects
  for select using (
    company_id is not null and public.is_company_member(company_id)
  );

drop policy if exists "project_files_select_company" on public.project_files;
create policy "project_files_select_company" on public.project_files
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_files.project_id
        and p.company_id is not null
        and public.is_company_member(p.company_id)
    )
  );

drop policy if exists "invoices_select_company" on public.invoices;
create policy "invoices_select_company" on public.invoices
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = invoices.project_id
        and p.company_id is not null
        and public.is_company_member(p.company_id)
    )
  );

drop policy if exists "wo_select_company" on public.work_orders;
create policy "wo_select_company" on public.work_orders
  for select using (
    company_id is not null and public.is_company_member(company_id)
  );

drop policy if exists "wo_attachments_select_company" on public.work_order_attachments;
create policy "wo_attachments_select_company" on public.work_order_attachments
  for select using (
    exists (
      select 1 from public.work_orders w
      where w.id = work_order_attachments.work_order_id
        and w.company_id is not null
        and public.is_company_member(w.company_id)
    )
  );
