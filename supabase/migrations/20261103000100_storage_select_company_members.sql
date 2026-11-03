-- =============================================================================
-- Storage SELECT: let active company members read the objects they can already
-- see as table rows (GAP 1). The storage predicate now matches the table SELECT
-- policies (project_files_select_owner_or_company,
-- wo_att_select_owner_or_company): owner, OR (company_id is not null AND
-- public.is_company_member(company_id)). is_company_member requires an active
-- membership. SELECT only; INSERT/DELETE policies are untouched. Re-runnable.
-- =============================================================================

-- project-files
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
            select 1 from public.project_files pf
            join public.projects p on p.id = pf.project_id
            where pf.storage_path = storage.objects.name
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
            select 1 from public.project_files pf
            join public.projects p on p.id = pf.project_id
            where pf.storage_path = storage.objects.name
              and p.owner_user_id = (select auth.uid())
          )
        );
    end if;
  end if;
end $$;

-- work-order-attachments
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
            select 1 from public.work_order_attachments a
            join public.work_orders w on w.id = a.work_order_id
            where a.storage_path = storage.objects.name
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
            select 1 from public.work_order_attachments a
            join public.work_orders w on w.id = a.work_order_id
            where a.storage_path = storage.objects.name
              and w.created_by = (select auth.uid())
          )
        );
    end if;
  end if;
end $$;
