-- =============================================================================
-- Unique project_files.storage_path (2026-10-23)
-- -----------------------------------------------------------------------------
-- A storage object is recorded at most once. lib/actions/files.ts
-- recordDeliverable already pre-checks for an existing row, but that check is
-- racy; this index makes the database the arbiter. recordDeliverable maps the
-- resulting 23505 to "storage_path already recorded" and never removes the
-- object (another row points at it).
--
-- The unique index also serves the storage.objects policy lookup
-- `pf.storage_path = name` (20261023000400).
--
-- Never skips silently: if duplicates exist the migration FAILS and reports
-- how many storage_path values are duplicated. Dedupe by hand, then re-run.
-- =============================================================================

do $$
declare
  v_dup_paths bigint;
  v_dup_rows  bigint;
begin
  select count(*), coalesce(sum(n), 0)
    into v_dup_paths, v_dup_rows
  from (
    select count(*) as n
    from public.project_files
    group by storage_path
    having count(*) > 1
  ) d;

  if v_dup_paths > 0 then
    raise exception
      'project_files.storage_path has % duplicated value(s) across % rows; dedupe before creating project_files_storage_path_key',
      v_dup_paths, v_dup_rows;
  end if;
end $$;

create unique index if not exists project_files_storage_path_key
  on public.project_files (storage_path);
