-- =============================================================================
-- dobeu.net v3 — initial schema (2026-05-21)
-- Tables: profiles, projects, project_files, invoices, messages, leads,
--         bookings, page_events
-- RLS: enabled on every table. Users see own data; admins see all.
-- =============================================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- =============================================================================
-- profiles — extends auth.users with app-specific fields
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  avatar_url text,
  apollo_contact_id text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_admin_all" on public.profiles
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_admin)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email = any(string_to_array(current_setting('app.admin_emails', true), ','))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- projects
-- =============================================================================
create type project_status as enum ('proposed', 'active', 'delivered', 'closed');

create table public.projects (
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

create index projects_owner_idx on public.projects(owner_user_id);
create index projects_status_idx on public.projects(status);

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select using (owner_user_id = auth.uid());

create policy "projects_admin_all" on public.projects
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- =============================================================================
-- project_files
-- =============================================================================
create table public.project_files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime text,
  size_bytes bigint,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '3 years')
);

create index project_files_project_idx on public.project_files(project_id);

alter table public.project_files enable row level security;

create policy "project_files_select_own" on public.project_files
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = project_files.project_id and p.owner_user_id = auth.uid()
    )
  );

create policy "project_files_admin_all" on public.project_files
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- =============================================================================
-- invoices
-- =============================================================================
create type invoice_status as enum ('open', 'paid', 'void', 'overdue');

create table public.invoices (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'USD',
  status invoice_status not null default 'open',
  stripe_invoice_id text,
  stripe_payment_intent text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index invoices_project_idx on public.invoices(project_id);
create index invoices_status_idx on public.invoices(status);

alter table public.invoices enable row level security;

create policy "invoices_select_own" on public.invoices
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = invoices.project_id and p.owner_user_id = auth.uid()
    )
  );

create policy "invoices_admin_all" on public.invoices
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- =============================================================================
-- messages
-- =============================================================================
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null,            -- equals project_id for project threads
  from_user_id uuid not null references auth.users(id),
  to_user_id uuid not null references auth.users(id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages(thread_id);
create index messages_recipient_idx on public.messages(to_user_id, read_at);

alter table public.messages enable row level security;

create policy "messages_select_participant" on public.messages
  for select using (from_user_id = auth.uid() or to_user_id = auth.uid());

create policy "messages_insert_sender" on public.messages
  for insert with check (from_user_id = auth.uid());

create policy "messages_update_recipient" on public.messages
  for update using (to_user_id = auth.uid());

create policy "messages_admin_all" on public.messages
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- =============================================================================
-- leads — anonymous form submissions before signup
-- =============================================================================
create type lead_source as enum ('book', 'form', 'email', 'typeform', 'other');

create table public.leads (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  name text,
  company text,
  apollo_contact_id text,
  source lead_source not null default 'other',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb
);

create index leads_email_idx on public.leads(email);
create index leads_source_idx on public.leads(source);
create index leads_last_seen_idx on public.leads(last_seen desc);

alter table public.leads enable row level security;

-- Anonymous users can insert (rate-limited at API layer)
create policy "leads_insert_anon" on public.leads
  for insert with check (true);

create policy "leads_admin_select" on public.leads
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "leads_admin_update" on public.leads
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- =============================================================================
-- bookings
-- =============================================================================
create type booking_status as enum ('scheduled', 'completed', 'cancelled', 'noshow');

create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references public.leads(id) on delete set null,
  email text not null,
  name text,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30,
  meeting_url text,
  apollo_meeting_id text,
  google_event_id text,
  status booking_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now()
);

create index bookings_scheduled_idx on public.bookings(scheduled_at);
create index bookings_email_idx on public.bookings(email);

alter table public.bookings enable row level security;

create policy "bookings_insert_anon" on public.bookings
  for insert with check (true);

create policy "bookings_admin_all" on public.bookings
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- =============================================================================
-- page_events — lightweight in-DB analytics mirror
-- =============================================================================
create table public.page_events (
  id uuid primary key default uuid_generate_v4(),
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  page_path text,
  occurred_at timestamptz not null default now()
);

create index page_events_session_idx on public.page_events(session_id);
create index page_events_event_idx on public.page_events(event_name, occurred_at desc);

alter table public.page_events enable row level security;

create policy "page_events_insert_anon" on public.page_events
  for insert with check (true);

create policy "page_events_admin_select" on public.page_events
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- =============================================================================
-- updated_at trigger helper
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Storage bucket for project files
-- =============================================================================
insert into storage.buckets (id, name, public)
  values ('project-files', 'project-files', false)
  on conflict (id) do nothing;

create policy "project_files_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'project-files' and (
      -- Owner can read their own project files
      exists (
        select 1 from public.project_files pf
        join public.projects p on p.id = pf.project_id
        where pf.storage_path = name and p.owner_user_id = auth.uid()
      )
      or
      -- Admin can read all
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
    )
  );

create policy "project_files_storage_admin_insert" on storage.objects
  for insert with check (
    bucket_id = 'project-files'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "project_files_storage_admin_delete" on storage.objects
  for delete using (
    bucket_id = 'project-files'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );
