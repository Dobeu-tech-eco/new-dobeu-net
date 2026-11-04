-- =============================================================================
-- company_members client writes: require AAL2 and an active company (D42).
--
-- The app layer (requireCompanyAdmin in lib/actions/company-auth.ts) already
-- demands rank >= 100, then an active company, then an AAL2 session. The RLS
-- policies only checked rank, so a direct PostgREST call with an AAL1 token (or
-- for a suspended company) bypassed the app gate. This closes that gap.
--
-- Fail closed: a missing/null 'aal' claim yields '' and therefore false.
-- The service role bypasses RLS and is unaffected.
-- Column grants, the activation trigger, company_members_select_comember,
-- company_role_rank and is_company_member are intentionally untouched.
-- =============================================================================

do $$
begin
  if to_regclass('public.company_members') is not null
     and to_regclass('public.companies') is not null
     and to_regclass('public.company_roles') is not null
     and to_regprocedure('public.company_role_rank(uuid)') is not null then

    create or replace function public.can_manage_company_members(cid uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = pg_catalog, public, pg_temp
    as $fn$
      select coalesce((select auth.jwt()->>'aal'), '') = 'aal2'
        and public.company_role_rank(cid) >= 100
        and exists (
          select 1 from public.companies c
          where c.id = cid and c.status = 'active'
        )
    $fn$;

    comment on function public.can_manage_company_members(uuid) is
      'True only for an AAL2 session whose user is an active rank>=100 member of an ACTIVE company. Fails closed (missing aal claim -> false). Mirrors requireCompanyAdmin: rank, then active company, then AAL2.';

    revoke execute on function public.can_manage_company_members(uuid) from public, anon;
    grant execute on function public.can_manage_company_members(uuid) to authenticated, service_role;

    drop policy if exists "company_members_admin_insert" on public.company_members;
    create policy "company_members_admin_insert" on public.company_members
      for insert
      to authenticated
      with check (
        public.can_manage_company_members(company_id)
        and status = 'invited'
        and invited_by = (select auth.uid())
        and coalesce(
          (select r.rank from public.company_roles r where r.key = company_members.role), 0
        ) <= public.company_role_rank(company_id)
      );

    drop policy if exists "company_members_admin_update" on public.company_members;
    create policy "company_members_admin_update" on public.company_members
      for update
      to authenticated
      using (public.can_manage_company_members(company_id))
      with check (
        public.can_manage_company_members(company_id)
        and coalesce(
          (select r.rank from public.company_roles r where r.key = company_members.role), 0
        ) <= public.company_role_rank(company_id)
      );

    drop policy if exists "company_members_admin_delete" on public.company_members;
    create policy "company_members_admin_delete" on public.company_members
      for delete
      to authenticated
      using (public.can_manage_company_members(company_id));
  end if;
end $$;
