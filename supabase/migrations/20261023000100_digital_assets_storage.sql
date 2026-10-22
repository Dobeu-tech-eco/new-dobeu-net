-- =============================================================================
-- digital-assets storage bucket + entitlement-gated read policy (2026-10-23)
-- -----------------------------------------------------------------------------
-- lib/actions/assets.ts getAssetDownloadUrl mints signed URLs for the
-- `digital-assets` bucket through the cookie-bound client, so Storage
-- evaluates storage.objects RLS as the caller. Before this migration the
-- bucket was never created by a migration (it may not exist on prod) and no
-- storage.objects policy covered it, so every entitled download failed.
--
-- What this migration does:
--   1. Creates the bucket as PRIVATE if it is missing (no-op if present).
--   2. Adds ONE SELECT policy for `authenticated`: an object is readable only
--      when it is the storage_path of an ACTIVE digital_assets row that the
--      caller is entitled to via asset_entitlements, either directly
--      (e.user_id = caller) or through an active company membership
--      (public.is_company_member(e.company_id)). Mirrors the table policies
--      digital_assets_select_active / asset_entitlements_select_entitled
--      recreated in 20261022000100.
--
-- Deliberately NOT added: any INSERT / UPDATE / DELETE policy on this bucket.
-- Asset uploads and removals stay service-role only.
--
-- Idempotent: bucket insert is `on conflict do nothing`; the policy is
-- `drop policy if exists` + `create policy`, guarded on every dependency.
-- =============================================================================

insert into storage.buckets (id, name, public)
  values ('digital-assets', 'digital-assets', false)
  on conflict (id) do nothing;

do $$
begin
  if to_regclass('storage.objects') is not null
     and to_regclass('public.digital_assets') is not null
     and to_regclass('public.asset_entitlements') is not null
     and to_regprocedure('public.is_company_member(uuid)') is not null then
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
              or (e.company_id is not null and public.is_company_member(e.company_id))
            )
        )
      );
  else
    raise notice 'digital_assets_storage_select_entitled skipped: storage.objects, digital_assets, asset_entitlements or is_company_member(uuid) missing';
  end if;
end $$;
