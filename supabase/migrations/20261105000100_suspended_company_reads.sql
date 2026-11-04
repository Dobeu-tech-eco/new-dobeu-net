-- =============================================================================
-- D44: members of a suspended company lose company-shared READS.
--
-- Adds public.is_active_company_member(cid): the same membership check as
-- is_company_member, plus companies.status = 'active', and switches the 10 company-shared data-read
-- policies to it: 7 public tables (projects, project_files, invoices,
-- work_orders, work_order_attachments, digital_assets, asset_entitlements) and
-- the 3 storage.objects SELECT policies (project-files, work-order-attachments,
-- digital-assets), so the bytes go dark together with the rows.
--
-- Deliberately UNCHANGED:
--   * public.is_company_member            (membership-only; all other callers)
--   * companies_select_member             (the /company layout and the portal
--                                          banner read the company row to show
--                                          the "suspended" notice)
--   * company_members_select_comember     (own row via user_id = auth.uid())
--   * wo_insert_own                       (write; separate product decision)
--   * owner / created_by / entitlement-user branches of every policy
--
-- Idempotent: create or replace + drop policy if exists + create; safe to run
-- twice. The service role bypasses RLS and is unaffected.
-- =============================================================================

do $$
begin
  if to_regclass('public.company_members') is null
     or to_regclass('public.companies') is null
     or to_regclass('public.projects') is null
     or to_regclass('public.project_files') is null
     or to_regclass('public.invoices') is null
     or to_regclass('public.work_orders') is null
     or to_regclass('public.work_order_attachments') is null
     or to_regclass('public.digital_assets') is null
     or to_regclass('public.asset_entitlements') is null
     or to_regclass('storage.objects') is null
     or to_regprocedure('public.is_company_member(uuid)') is null then
    raise exception 'D44 suspended-company reads: missing prerequisite table/function';
  end if;
end $$;

create or replace function public.is_active_company_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    where m.company_id = cid
      and m.user_id = auth.uid()
      and m.status = 'active'
      and c.status = 'active'
  );
$fn$;

comment on function public.is_active_company_member(uuid) is
  'True when auth.uid() is an active member of cid AND companies.status = ''active''. Used by company-scoped SELECT policies so a suspended company''s members lose read access. is_company_member stays membership-only.';

revoke execute on function public.is_active_company_member(uuid) from public, anon;
grant execute on function public.is_active_company_member(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- public tables
drop policy if exists "projects_select_owner_or_company" on public.projects;
create policy "projects_select_owner_or_company" on public.projects
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (company_id is not null and public.is_active_company_member(company_id))
  );

drop policy if exists "project_files_select_owner_or_company" on public.project_files;
create policy "project_files_select_owner_or_company" on public.project_files
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_files.project_id
        and (
          p.owner_user_id = (select auth.uid())
          or (p.company_id is not null and public.is_active_company_member(p.company_id))
        )
    )
  );

drop policy if exists "invoices_select_owner_or_company" on public.invoices;
create policy "invoices_select_owner_or_company" on public.invoices
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.projects p
      where p.id = invoices.project_id
        and (
          p.owner_user_id = (select auth.uid())
          or (p.company_id is not null and public.is_active_company_member(p.company_id))
        )
    )
  );

drop policy if exists "wo_select_owner_or_company" on public.work_orders;
create policy "wo_select_owner_or_company" on public.work_orders
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or (company_id is not null and public.is_active_company_member(company_id))
  );

drop policy if exists "wo_att_select_owner_or_company" on public.work_order_attachments;
create policy "wo_att_select_owner_or_company" on public.work_order_attachments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.work_orders w
      where w.id = work_order_attachments.work_order_id
        and (
          w.created_by = (select auth.uid())
          or (w.company_id is not null and public.is_active_company_member(w.company_id))
        )
    )
  );

drop policy if exists "digital_assets_select_active" on public.digital_assets;
create policy "digital_assets_select_active" on public.digital_assets
  for select
  to authenticated
  using (
    active
    and exists (
      select 1 from public.asset_entitlements e
      where e.asset_id = digital_assets.id
        and (
          e.user_id = (select auth.uid())
          or (e.company_id is not null and public.is_active_company_member(e.company_id))
        )
    )
  );

drop policy if exists "asset_entitlements_select_entitled" on public.asset_entitlements;
create policy "asset_entitlements_select_entitled" on public.asset_entitlements
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (company_id is not null and public.is_active_company_member(company_id))
  );

-- ---------------------------------------------------------------- storage.objects
-- Same predicate as the table policies, otherwise a suspended member could
-- still fetch the bytes (signed URLs / storage API) the tables now hide.
drop policy if exists "project_files_storage_select_owner_or_company" on storage.objects;
create policy "project_files_storage_select_owner_or_company" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.project_files pf
      join public.projects p on p.id = pf.project_id
      where pf.storage_path = storage.objects.name
        and (
          p.owner_user_id = (select auth.uid())
          or (p.company_id is not null and public.is_active_company_member(p.company_id))
        )
    )
  );

drop policy if exists "wo_attachments_storage_select_owner_or_company" on storage.objects;
create policy "wo_attachments_storage_select_owner_or_company" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'work-order-attachments'
    and exists (
      select 1 from public.work_order_attachments a
      join public.work_orders w on w.id = a.work_order_id
      where a.storage_path = storage.objects.name
        and (
          w.created_by = (select auth.uid())
          or (w.company_id is not null and public.is_active_company_member(w.company_id))
        )
    )
  );

drop policy if exists "digital_assets_storage_select_entitled" on storage.objects;
create policy "digital_assets_storage_select_entitled" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'digital-assets'
    and exists (
      select 1
      from public.digital_assets da
      join public.asset_entitlements e on e.asset_id = da.id
      where da.storage_path = objects.name
        and da.active
        and (
          e.user_id = (select auth.uid())
          or (e.company_id is not null and public.is_active_company_member(e.company_id))
        )
    )
  );

-- ---------------------------------------------------------------- drift guard
-- Permissive policies OR together: a stray permissive SELECT/ALL policy would
-- silently re-grant suspended members access. Fail loudly. Both checks are an
-- exact name allowlist: on the seven tables and on storage.objects, ANY
-- permissive SELECT/ALL policy not named here raises, whatever its text (a
-- `using (true)` or `bucket_id like ...` policy names no bucket, so matching
-- on bucket names would miss it). The check lives in a function in the
-- non-API `private` schema so pgTAP can exercise the real check.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.d44_assert_read_policy_set()
returns void
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_stray text;
begin
  select string_agg(schemaname::text || '.' || tablename::text || '.' || policyname::text, ', '
                    order by schemaname, tablename, policyname)
    into v_stray
    from pg_catalog.pg_policies
   where permissive = 'PERMISSIVE'
     and cmd in ('SELECT', 'ALL')
     and (
       (schemaname = 'public'
        and tablename in ('projects', 'project_files', 'invoices', 'work_orders',
                          'work_order_attachments', 'digital_assets', 'asset_entitlements')
        and policyname not in (
          'projects_select_owner_or_company', 'project_files_select_owner_or_company',
          'invoices_select_owner_or_company', 'wo_select_owner_or_company',
          'wo_att_select_owner_or_company', 'digital_assets_select_active',
          'asset_entitlements_select_entitled'))
       or
       (schemaname = 'storage'
        and tablename = 'objects'
        and policyname not in (
          'project_files_storage_select_owner_or_company',
          'wo_attachments_storage_select_owner_or_company',
          'digital_assets_storage_select_entitled'))
     );
  if v_stray is not null then
    raise exception 'D44 migration: unexpected permissive SELECT/ALL policy (%)', v_stray;
  end if;
end
$fn$;

revoke execute on function private.d44_assert_read_policy_set() from public, anon, authenticated;

select private.d44_assert_read_policy_set();
