-- Phase 5: physically drop the now-unused profiles.is_admin column.
-- Its RLS/trigger dependence was removed in 20260605000000_phase1_reconciliation.sql;
-- ADMIN_EMAILS (env) is the sole admin gate. Admin reads use the service-role client.
alter table public.profiles drop column if exists is_admin;
