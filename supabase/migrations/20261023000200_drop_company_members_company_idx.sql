-- =============================================================================
-- Drop the redundant company_members(company_id) index (2026-10-23)
-- -----------------------------------------------------------------------------
-- 20260717120000_multi_tenant_companies.sql declares `unique (company_id,
-- user_id)` on public.company_members (auto-named
-- company_members_company_id_user_id_key). Its backing btree index LEADS with
-- company_id, so it already serves every company_id lookup (including the
-- is_company_member / company_role_rank helpers and the FK). The separate
-- company_members_company_idx is pure write and storage overhead
-- (docs/security/rls-audit-2026-10.md, D4).
--
-- Safety: refuse to drop unless a unique index leading with company_id is
-- present, so a drifted schema never loses its only company_id index.
-- =============================================================================

do $$
begin
  if to_regclass('public.company_members') is not null
     and not exists (
       select 1
       from pg_index i
       join pg_attribute a
         on a.attrelid = i.indrelid
        and a.attnum = i.indkey[0]
       where i.indrelid = to_regclass('public.company_members')
         and i.indisunique
         and a.attname = 'company_id'
     ) then
    raise exception 'company_members has no unique index leading with company_id; refusing to drop company_members_company_idx';
  end if;
end $$;

drop index if exists public.company_members_company_idx;
