-- =============================================================================
-- dobeu.net v3 — live schema repair (2026-06-17)
-- Fixes drift on Vercel Supabase ipmjokuezeuukhrilduq:
--   - profiles.updated_at + trigger
--   - profiles.stripe_customer_id + partial unique index (Phase 3)
--   - public.projects table (missing while project_files exists)
-- Idempotent: safe to re-run.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- =============================================================================
-- updated_at helper (from initial schema)
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- profiles.updated_at
-- =============================================================================
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Phase 3: profiles.stripe_customer_id (from 20260615000000)
-- =============================================================================
alter table public.profiles
  add column if not exists stripe_customer_id text;

create unique index if not exists profiles_stripe_customer_id_unique
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.profiles.stripe_customer_id is
  'Stripe customer ID (cus_*); lazy-created on first invoice issued.';

-- =============================================================================
-- projects (from 20260521000000_initial_schema.sql)
-- NO projects_admin_all — per 20260605000000 phase1 reconciliation
-- =============================================================================
do $$ begin
  create type project_status as enum ('proposed', 'active', 'delivered', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status project_status not null default 'proposed',
  started_at timestamptz,
  delivered_at timestamptz,
  total_cents integer not null default 0,
  stripe_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects(owner_user_id);
create index if not exists projects_status_idx on public.projects(status);

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (owner_user_id = auth.uid());

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- =============================================================================
-- project_files FK repair — add only when both tables exist, FK absent, no orphans
-- =============================================================================
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'project_files'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'projects'
  ) then
    if not exists (
      select 1
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
        and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
        and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and tc.table_name = 'project_files'
        and kcu.column_name = 'project_id'
        and ccu.table_name = 'projects'
    ) then
      if not exists (
        select 1
        from public.project_files pf
        left join public.projects p on p.id = pf.project_id
        where p.id is null
      ) then
        alter table public.project_files
          add constraint project_files_project_id_fkey
          foreign key (project_id) references public.projects(id) on delete cascade;
      end if;
    end if;
  end if;
end $$;
