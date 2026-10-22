-- =============================================================================
-- Unique storage_path on digital_assets + work_order_attachments (2026-10-23)
-- -----------------------------------------------------------------------------
-- The storage.objects SELECT policies (20261023000100, 20261023000400) grant
-- an object when ANY row with `storage_path = objects.name` grants it. If two
-- rows shared a path, both audiences could download the same bytes. This
-- closes that union for the two remaining tables (project_files is covered by
-- 20261023000300) and gives each policy lookup an index instead of a seq scan.
--
-- Never skips silently: a missing table or any duplicated storage_path makes
-- the migration FAIL with the counts. Dedupe by hand, then re-run.
-- =============================================================================

do $$
declare
  r record;
  v_dup_paths bigint;
  v_dup_rows  bigint;
begin
  for r in select * from (values ('digital_assets'), ('work_order_attachments')) as t(table_name)
  loop
    if to_regclass('public.' || r.table_name) is null then
      raise exception 'public.% is missing; cannot add a unique storage_path index', r.table_name;
    end if;

    execute format(
      'select count(*), coalesce(sum(n), 0) from (
         select count(*) as n from public.%I group by storage_path having count(*) > 1
       ) d',
      r.table_name
    ) into v_dup_paths, v_dup_rows;

    if v_dup_paths > 0 then
      raise exception
        '%.storage_path has % duplicated value(s) across % rows; dedupe before creating the unique index',
        r.table_name, v_dup_paths, v_dup_rows;
    end if;
  end loop;
end $$;

create unique index if not exists digital_assets_storage_path_key
  on public.digital_assets (storage_path);

create unique index if not exists work_order_attachments_storage_path_key
  on public.work_order_attachments (storage_path);
