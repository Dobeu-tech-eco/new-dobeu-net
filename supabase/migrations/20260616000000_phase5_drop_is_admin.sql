-- Phase 5: physically drop the now-unused profiles.is_admin column.
-- ADMIN_EMAILS (env) is the sole admin gate. Admin reads use the service-role client.

-- -----------------------------------------------------------------------------
-- 1. Neutralize `profiles.is_admin`-dependent RLS.
--    Admin reads route through `createAdminClient()` (service role bypasses RLS)
--    so the column-driven policies are dead weight and risk drift against the
--    real env-driven gate (`ADMIN_EMAILS`).
--
--    Keep the user-scoped own-row policies. Drop the admin_* policies. Replace
--    the previously broad `profiles_admin_all` policy with nothing -- nobody
--    queries `profiles` from the RLS path as an admin (it would go via service
--    role).
-- -----------------------------------------------------------------------------
drop policy if exists "profiles_admin_all"       on public.profiles;
drop policy if exists "projects_admin_all"       on public.projects;
drop policy if exists "project_files_admin_all"  on public.project_files;
drop policy if exists "invoices_admin_all"       on public.invoices;
drop policy if exists "leads_admin_select"       on public.leads;
drop policy if exists "leads_admin_update"       on public.leads;
drop policy if exists "bookings_admin_all"       on public.bookings;
drop policy if exists "page_events_admin_select" on public.page_events;

-- Also drop the storage policies that gated on `profiles.is_admin`. Storage
-- access for admins flows through the service-role path going forward.
drop policy if exists "project_files_storage_select_own"   on storage.objects;
drop policy if exists "project_files_storage_admin_insert" on storage.objects;
drop policy if exists "project_files_storage_admin_delete" on storage.objects;

-- Re-add the user-scoped read policy for `project-files` storage without the
-- is_admin branch. Admin access is now exclusively service-role.
create policy "project_files_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.project_files pf
      join public.projects p on p.id = pf.project_id
      where pf.storage_path = name and p.owner_user_id = auth.uid()
    )
  );

-- Rewrite the `handle_new_user` trigger so it no longer computes `is_admin`
-- from a postgres GUC. The column keeps its default `false` and stops drifting.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Drop the column.
-- -----------------------------------------------------------------------------
alter table public.profiles drop column if exists is_admin;
