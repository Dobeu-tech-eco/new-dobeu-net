-- =============================================================================
-- Company-aware storage reads for project files + work-order attachments
-- (2026-10-23, decision D2 = option A: company members may download)
-- -----------------------------------------------------------------------------
-- 20261022000100 consolidated the TABLE read policies to owner OR active
-- company member (project_files_select_owner_or_company,
-- wo_att_select_owner_or_company), but the matching storage.objects policies
-- (project_files_storage_select_own, wo_attachments_storage_select_own) stayed
-- owner-only. A company member could list a deliverable but not download it.
--
-- This migration replaces both storage SELECT policies with equivalents that
-- mirror the table policies exactly: the owner, OR an active member of the
-- project's / work order's company via public.is_company_member(company_id).
-- The old `_own` names are dropped so the name matches the semantics.
--
-- SELECT only. wo_attachments_storage_insert_own / _delete_own are untouched,
-- and no INSERT / UPDATE / DELETE policy is added or widened.
--
-- Drift guard (same as 20261022000100 sections 6 and 10): when
-- is_company_member(uuid) or the company_id column is missing, the policy is
-- created owner-only instead of failing.
-- =============================================================================

-- project-files bucket ---------------------------------------------------------
do $$
declare
  v_company boolean :=
    to_regprocedure('public.is_company_member(uuid)') is not null
    and exists (
      select 1 from pg_attribute
      where attrelid = to_regclass('public.projects')
        and attname = 'company_id' and not attisdropped
    );
begin
  if to_regclass('storage.objects') is not null
     and to_regclass('public.project_files') is not null
     and to_regclass('public.projects') is not null then
    drop policy if exists "project_files_storage_select_own" on storage.objects;
    drop policy if exists "project_files_storage_select_owner_or_company" on storage.objects;

    if v_company then
      create policy "project_files_storage_select_owner_or_company" on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'project-files'
          and exists (
            select 1
            from public.project_files pf
            join public.projects p on p.id = pf.project_id
            where pf.storage_path = objects.name
              and (
                p.owner_user_id = (select auth.uid())
                or (p.company_id is not null and public.is_company_member(p.company_id))
              )
          )
        );
    else
      create policy "project_files_storage_select_owner_or_company" on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'project-files'
          and exists (
            select 1
            from public.project_files pf
            join public.projects p on p.id = pf.project_id
            where pf.storage_path = objects.name
              and p.owner_user_id = (select auth.uid())
          )
        );
    end if;
  else
    raise notice 'project_files_storage_select_owner_or_company skipped: storage.objects, project_files or projects missing';
  end if;
end $$;

-- work-order-attachments bucket ------------------------------------------------
do $$
declare
  v_company boolean :=
    to_regprocedure('public.is_company_member(uuid)') is not null
    and exists (
      select 1 from pg_attribute
      where attrelid = to_regclass('public.work_orders')
        and attname = 'company_id' and not attisdropped
    );
begin
  if to_regclass('storage.objects') is not null
     and to_regclass('public.work_order_attachments') is not null
     and to_regclass('public.work_orders') is not null then
    drop policy if exists "wo_attachments_storage_select_own" on storage.objects;
    drop policy if exists "wo_attachments_storage_select_owner_or_company" on storage.objects;

    if v_company then
      create policy "wo_attachments_storage_select_owner_or_company" on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'work-order-attachments'
          and exists (
            select 1
            from public.work_order_attachments a
            join public.work_orders w on w.id = a.work_order_id
            where a.storage_path = objects.name
              and (
                w.created_by = (select auth.uid())
                or (w.company_id is not null and public.is_company_member(w.company_id))
              )
          )
        );
    else
      create policy "wo_attachments_storage_select_owner_or_company" on storage.objects
        for select
        to authenticated
        using (
          bucket_id = 'work-order-attachments'
          and exists (
            select 1
            from public.work_order_attachments a
            join public.work_orders w on w.id = a.work_order_id
            where a.storage_path = objects.name
              and w.created_by = (select auth.uid())
          )
        );
    end if;
  else
    raise notice 'wo_attachments_storage_select_owner_or_company skipped: storage.objects, work_order_attachments or work_orders missing';
  end if;
end $$;
