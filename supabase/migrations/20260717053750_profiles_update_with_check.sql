-- =============================================================================
-- dobeu.net v3 — profiles UPDATE policy hardening (2026-07-17)
-- -----------------------------------------------------------------------------
-- profiles_update_own (from 20260521000000_initial_schema.sql) only has a
-- USING clause, not WITH CHECK. Postgres RLS applies USING to the pre-update
-- row and WITH CHECK to the post-update row; without WITH CHECK a client could
-- issue `update profiles set id = <someone-else>` and reassign ownership of
-- their own row, since only the row being *read* is checked against
-- auth.uid(), not the row being *written*.
--
-- `(select auth.uid())` wrapper is the Supabase/Postgres-recommended form so
-- the planner caches the value once per statement instead of re-evaluating
-- the stable function per row.
--
-- Idempotent: safe to re-run.
-- =============================================================================

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own" on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
