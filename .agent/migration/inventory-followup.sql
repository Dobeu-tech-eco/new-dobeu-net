-- =============================================================================
-- Legacy DB inventory follow-up — `db-dobeutech-unified`
-- =============================================================================
-- Run each block in Supabase Studio SQL Editor (legacy project) or via psql.
-- Export results (CSV or copy/paste) into `.agent/migration/inventory.md`
-- Findings §4–§8.
--
-- Repo references for table names:
--   lib/leads.ts (historical LEAD_TABLES): leads, dobeu_net_leads, contact_submissions
--   PRODUCTION-PLAN §6.2: client_files → project_files; users → auth.users + profiles
--   CHAT-TRANSCRIPT-2026-05-21: projects, messages, services, purchases,
--     rate_limits, newsletter_*, audit_logs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- §1 — Full public table list (export this result)
-- -----------------------------------------------------------------------------
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;

-- -----------------------------------------------------------------------------
-- §2 — Approximate row counts (all 30 tables — export full result)
-- -----------------------------------------------------------------------------
select schemaname,
       relname as table_name,
       n_live_tup as approx_rows
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc, relname;

-- -----------------------------------------------------------------------------
-- §3 — Exact counts for every table with approx_rows > 0
-- (Run after §2; generates one COUNT per non-empty table.)
-- Copy the generated statements and execute them, or use the dynamic block below.
-- -----------------------------------------------------------------------------

-- Option A: dynamic — returns exact count per table with planner rows > 0
do $$
declare
  r record;
  cnt bigint;
begin
  raise notice 'table_name | exact_count';
  raise notice '-----------+------------';
  for r in
    select relname as table_name
    from pg_stat_user_tables
    where schemaname = 'public'
      and n_live_tup > 0
    order by n_live_tup desc, relname
  loop
    execute format('select count(*) from public.%I', r.table_name) into cnt;
    raise notice '% | %', r.table_name, cnt;
  end loop;
end $$;

-- Option B: manual templates (uncomment and run per table from §2 output)
-- select count(*) as exact_count from public.composio_tools;
-- select count(*) as exact_count from public.analytics_daily;
-- select count(*) as exact_count from public.dobeu_ecosystem;
-- select count(*) as exact_count from public.cloud_accounts;
-- select count(*) as exact_count from public.cowork_task_state;
-- select count(*) as exact_count from public.service_credentials;
-- select count(*) as exact_count from public.client_files;

-- -----------------------------------------------------------------------------
-- §4 — Column schema: portal / marketing tables (known + pattern match)
-- -----------------------------------------------------------------------------

-- 4a — Fixed list from repo plans + confirmed inventory
select table_name,
       column_name,
       data_type,
       is_nullable,
       column_default,
       ordinal_position
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'client_files',
    'contact_submissions',
    'profiles',
    'projects',
    'invoices',
    'users',
    'messages',
    'services',
    'purchases',
    'bookings',
    'rate_limits'
  )
order by table_name, ordinal_position;

-- 4b — Any public table matching portal/marketing/newsletter patterns
--       (catches hidden tables among the 24 not visible in screenshots)
select table_name,
       column_name,
       data_type,
       is_nullable,
       column_default,
       ordinal_position
from information_schema.columns
where table_schema = 'public'
  and (
    table_name like '%lead%'
    or table_name like '%contact%'
    or table_name like '%project%'
    or table_name like '%invoice%'
    or table_name like '%client%'
    or table_name like '%user%'
    or table_name like '%profile%'
    or table_name like '%booking%'
    or table_name like '%message%'
    or table_name like '%newsletter%'
    or table_name like '%purchase%'
    or table_name like '%service%'
    or table_name like 'dobeu_net_%'
    or table_name like '%page_event%'
  )
order by table_name, ordinal_position;

-- -----------------------------------------------------------------------------
-- §5 — Foreign keys (all public tables)
-- -----------------------------------------------------------------------------
select tc.table_name,
       kcu.column_name,
       ccu.table_name  as references_table,
       ccu.column_name as references_column,
       tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema   = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema    = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

-- -----------------------------------------------------------------------------
-- §6 — RLS policies (all public tables)
-- -----------------------------------------------------------------------------
select schemaname,
       tablename,
       policyname,
       permissive,
       roles::text,
       cmd,
       qual,
       with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- -----------------------------------------------------------------------------
-- §7 — Storage buckets + object counts
-- -----------------------------------------------------------------------------
select id, name, public, created_at
from storage.buckets
order by name;

select bucket_id, count(*) as object_count
from storage.objects
group by bucket_id
order by object_count desc;

-- -----------------------------------------------------------------------------
-- §8 — Auth users (cannot bulk-insert; informs whether Admin API import needed)
-- -----------------------------------------------------------------------------
select count(*) as auth_users_count from auth.users;

-- Optional: list auth users (emails only — do not commit output to git)
-- select id, email, created_at from auth.users order by created_at;

-- -----------------------------------------------------------------------------
-- Bonus — existence check for v3 target table names on legacy
-- -----------------------------------------------------------------------------
select t.table_name,
       to_regclass('public.' || t.table_name) is not null as exists_on_legacy
from (values
  ('profiles'),
  ('projects'),
  ('project_files'),
  ('invoices'),
  ('leads'),
  ('bookings'),
  ('page_events'),
  ('work_orders'),
  ('client_files'),
  ('contact_submissions'),
  ('users'),
  ('messages'),
  ('services'),
  ('purchases')
) as t(table_name)
order by t.table_name;
