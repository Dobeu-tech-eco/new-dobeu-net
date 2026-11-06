-- =============================================================================
-- D52: members of a suspended company cannot submit company work orders.
--
-- Replaces public.wo_insert_own so the company branch uses
-- public.is_active_company_member (D44, 20261105000100) instead of
-- is_company_member. Everything else in the policy (own-row check, open status,
-- cleared quote/milestone columns, project ownership) is identical to the
-- definition in 20261022000100_rls_advisor_hardening.sql, so a personal work
-- order (company_id null) behaves exactly as before.
--
-- L-024: permissive policies OR together, so before and after replacing the
-- policy this migration raises if any permissive INSERT/ALL policy other than
-- wo_insert_own exists on public.work_orders (exact-name allowlist, in a
-- private function so pgTAP can probe the real check).
--
-- Idempotent. The service role bypasses RLS and is unaffected.
-- =============================================================================

do $$
begin
  if to_regclass('public.work_orders') is null
     or to_regclass('public.projects') is null
     or to_regprocedure('public.is_active_company_member(uuid)') is null then
    raise exception 'D52 wo_insert_own: missing prerequisite table/function (needs D44 20261105000100)';
  end if;
  if not exists (
    select 1 from pg_attribute
    where attrelid = to_regclass('public.work_orders')
      and attname = 'cancelled_at' and not attisdropped
  ) then
    raise exception 'D52 wo_insert_own: work_orders.cancelled_at missing';
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.assert_wo_insert_policy_set()
returns void
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_extra text;
begin
  select string_agg(policyname::text, ', ' order by policyname)
    into v_extra
  from pg_policies
  where schemaname = 'public'
    and tablename = 'work_orders'
    and permissive = 'PERMISSIVE'
    and cmd in ('INSERT', 'ALL')
    and policyname <> 'wo_insert_own';
  if v_extra is not null then
    raise exception 'D52 wo_insert_own: unexpected permissive INSERT/ALL policy on public.work_orders: %', v_extra;
  end if;
end;
$fn$;

revoke all on function private.assert_wo_insert_policy_set() from public, anon, authenticated;

select private.assert_wo_insert_policy_set();

drop policy if exists "wo_insert_own" on public.work_orders;
create policy "wo_insert_own" on public.work_orders
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and status = 'open'
    and quoted_amount_cents is null
    and quoted_at is null
    and accepted_at is null
    and invoice_id is null
    and in_progress_at is null
    and delivered_at is null
    and closed_at is null
    and cancelled_at is null
    and (company_id is null or public.is_active_company_member(company_id))
    and (
      project_id is null
      or exists (
        select 1 from public.projects p
        where p.id = work_orders.project_id
          and p.owner_user_id = (select auth.uid())
          and (
            work_orders.company_id is null
            or p.company_id = work_orders.company_id
          )
      )
    )
  );

select private.assert_wo_insert_policy_set();
