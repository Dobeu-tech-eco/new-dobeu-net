-- =============================================================================
-- Legacy → Vercel Supabase mapping SQL (DRAFT)
-- =============================================================================
-- Draft based on partial inventory 2026-06-16; do NOT run until follow-up
-- schema queries complete (see inventory-followup.sql + inventory.md §4–§8).
--
-- Target schema: supabase/migrations/20260521000000_initial_schema.sql
--                 + 20260605000000_phase1_reconciliation.sql
--                 + 20260616000000_phase5_drop_is_admin.sql
--
-- Strategy: SELECTIVE migration — portal-relevant tables only. Do NOT restore
-- full legacy pg_dump (would import composio_tools etc.).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXCLUDED — unified-platform tables (NOT in dobeu.net v3 schema)
-- Do not migrate unless operator explicitly requests.
-- -----------------------------------------------------------------------------
-- agent_principles
-- analytics_daily
-- audit_logs
-- ccpa_requests
-- cloud_accounts
-- composio_tools          (3072 rows — platform tooling)
-- cowork_task_state
-- dobeu_ecosystem
-- service_credentials
-- (... any other legacy table not listed in MIGRATE section below)

-- -----------------------------------------------------------------------------
-- SKIPPED — lead sources (confirmed empty / absent)
-- -----------------------------------------------------------------------------
-- public.leads              — does not exist on legacy (to_regclass NULL)
-- public.dobeu_net_leads    — does not exist on legacy (to_regclass NULL)
-- public.contact_submissions — exists, count(*) = 0 → no-op

-- contact_submissions → public.leads (0 rows — skip or no-op INSERT)
-- Uncomment only if follow-up finds rows:
/*
insert into public.leads (
  email,
  name,
  company,
  source,
  first_seen,
  last_seen,
  raw_payload
)
select
  cs.email,                                    -- TODO: confirm column name
  cs.name,                                     -- TODO: confirm column name
  cs.company,                                  -- TODO: confirm column name
  coalesce(cs.source::text, 'form')::lead_source,
  coalesce(cs.created_at, now())::timestamptz,
  coalesce(cs.created_at, now())::timestamptz,
  to_jsonb(cs) - 'email' - 'name' - 'company'  -- TODO: adjust after §4 schema
from legacy_import.contact_submissions cs
where false;  -- guard: remove when schema confirmed and rows > 0
*/

-- -----------------------------------------------------------------------------
-- MIGRATE — client_files → project_files (schema TBD)
-- -----------------------------------------------------------------------------
-- PRODUCTION-PLAN §6.2: map storage_path/filename/mime/size_bytes; resolve
-- project_id FK; set uploaded_by to admin uuid if legacy lacks it;
-- retention_until = uploaded_at + 3 years.
-- Storage objects: copy legacy bucket → target project-files (separate step).

-- TODO: confirm legacy client_files columns via inventory-followup.sql §4
-- TODO: confirm row count (not in top-6 approx_rows screenshot)
-- TODO: build legacy_id → uuid map for projects if legacy PKs differ

/*
insert into public.project_files (
  id,
  project_id,
  storage_path,
  filename,
  mime,
  size_bytes,
  uploaded_by,
  uploaded_at,
  retention_until
)
select
  uuid_generate_v4(),                          -- or deterministic map from legacy PK
  pm.target_project_id,                        -- join via temp id_map_projects
  cf.storage_path,                             -- TODO: column name
  cf.filename,                                 -- TODO: column name
  cf.mime,                                     -- TODO: column name
  cf.size_bytes,                               -- TODO: column name
  coalesce(cf.uploaded_by, :admin_user_uuid),  -- TODO: operator supplies admin uuid
  coalesce(cf.created_at, now())::timestamptz,
  coalesce(cf.created_at, now())::timestamptz + interval '3 years'
from legacy_import.client_files cf
join temp_id_map_projects pm on pm.legacy_id = cf.project_id;  -- TODO: FK column
*/

-- -----------------------------------------------------------------------------
-- PENDING — await inventory-followup.sql (existence + schema unknown)
-- -----------------------------------------------------------------------------

-- users → auth.users + profiles (Admin API script, not bulk INSERT)
--   TODO: confirm public.users exists and auth.users count > 0

-- projects → public.projects
--   TODO: confirm table exists; map owner_user_id via auth user id map

-- invoices → public.invoices
--   TODO: confirm table exists; normalize status enum

-- bookings → public.bookings
--   TODO: confirm table exists on legacy (may be dobeu_net_bookings)

-- messages → DROP (Intercom owns chat; reconciliation migration dropped messages)

-- page_events ← legacy analytics (low priority; migrate only if cheap)
--   analytics_daily excluded (platform table, not page_events shape)

-- -----------------------------------------------------------------------------
-- Verification queries (run on target after mapping)
-- -----------------------------------------------------------------------------
-- select 'leads' as tbl, count(*) from public.leads
-- union all select 'projects', count(*) from public.projects
-- union all select 'project_files', count(*) from public.project_files
-- union all select 'invoices', count(*) from public.invoices
-- union all select 'profiles', count(*) from public.profiles;
