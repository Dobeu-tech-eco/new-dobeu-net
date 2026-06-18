-- =============================================================================
-- Legacy → Vercel Supabase mapping SQL
-- =============================================================================
-- Status: NO-OP (2026-06-17) — see cutover-decision.md
--
-- Inventory confirmed zero portal rows and absent v3 tables on legacy:
--   contact_submissions = 0, client_files = 0, no leads/bookings/invoices
--   messages exists but v3 dropped (Intercom)
--   auth.users = 3 (optional Admin API import — import-auth-users.mjs)
--
-- Target schema already applied on ipmjokuezeuukhrilduq. Do NOT run INSERTs below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- NO-OP — all public data tables (empty or absent on legacy)
-- -----------------------------------------------------------------------------

-- contact_submissions → public.leads
--   Legacy: exists, count = 0. Skipped.

-- client_files → public.project_files
--   Legacy: exists, count = 0. No storage copy.

-- public.leads / dobeu_net_leads
--   Absent on legacy (to_regclass NULL).

-- public.invoices, public.bookings
--   Absent on legacy (bonus existence query).

-- legacy messages → public.messages
--   Legacy messages table exists; v3 dropped messages — Intercom owns chat.

-- projects, invoices (portal), page_events, work_orders, services, purchases
--   Not migrated — no confirmed rows / not v3-critical for cutover.

-- -----------------------------------------------------------------------------
-- OPTIONAL — auth.users (not SQL; Admin API only)
-- -----------------------------------------------------------------------------
-- Three legacy auth.users. Passwords do not migrate (magic-link app).
-- Operator may pre-seed via: node .agent/migration/import-auth-users.mjs
-- Or users sign in organically; handle_new_user() creates profiles.

-- -----------------------------------------------------------------------------
-- EXCLUDED — unified-platform tables (never migrate to dobeu.net v3)
-- -----------------------------------------------------------------------------
-- agent_principles, analytics_daily, audit_logs, ccpa_requests, cloud_accounts,
-- composio_tools (3072 rows), cowork_task_state, dobeu_ecosystem,
-- service_credentials, (... other legacy platform tables)

-- -----------------------------------------------------------------------------
-- Verification queries (run on target — expect empty portal data unless organic signups)
-- -----------------------------------------------------------------------------
-- select 'leads' as tbl, count(*) from public.leads
-- union all select 'projects', count(*) from public.projects
-- union all select 'project_files', count(*) from public.project_files
-- union all select 'invoices', count(*) from public.invoices
-- union all select 'profiles', count(*) from public.profiles;
