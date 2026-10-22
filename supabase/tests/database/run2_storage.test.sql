-- =============================================================================
-- pgTAP: Run 2 storage + index migrations
--   20261023000100_digital_assets_storage.sql        (T1)
--   20261023000200_drop_company_members_company_idx.sql (T2)
--   20261023000300_project_files_storage_path_unique.sql (T3)
--   20261023000400_company_storage_select.sql        (T11)
--   20261023000500_storage_path_unique_indexes.sql   (fix round 1, M2/M3)
-- Run: pnpm supabase test db   (local), or inside a forced-rollback batch on
-- prod. Self-contained: every fixture is created here and rolled back; no
-- existing row is read or relied on. Every authenticated read is scoped to
-- the fixture object names so unrelated prod objects cannot affect results.
--
-- Fixtures (uuid prefix 5e2a, distinct from rls_hardening.test.sql):
--   OWNER    owns project P (company X) and work order W (company X);
--            directly entitled to DA1 (active) and DA3 (INACTIVE)
--   MEMBER   active employee of company X; company X is entitled to DA2
--   OUTSIDER signed-in user with no membership and no grants
--   OTHERCO  active employee of company Y only
--   INVITED  'invited' (not active) member of company X
--   DISABLED 'disabled' member of company X
--   ORPHAN   object in digital-assets with no digital_assets row
--   DECOYS   direct.zip.bak (suffix), Direct.zip (case), and direct.zip in the
--            project-files bucket (same name, other bucket): all denied
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

-- -----------------------------------------------------------------------------
-- Fixtures (as the migration owner, bypassing RLS)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('5e2a0001-0000-4000-8000-000000000001', 'run2-storage-owner@example.test',    'authenticated', 'authenticated'),
  ('5e2a0001-0000-4000-8000-000000000002', 'run2-storage-member@example.test',   'authenticated', 'authenticated'),
  ('5e2a0001-0000-4000-8000-000000000003', 'run2-storage-outsider@example.test', 'authenticated', 'authenticated'),
  ('5e2a0001-0000-4000-8000-000000000004', 'run2-storage-otherco@example.test',  'authenticated', 'authenticated'),
  ('5e2a0001-0000-4000-8000-000000000005', 'run2-storage-invited@example.test',  'authenticated', 'authenticated'),
  ('5e2a0001-0000-4000-8000-000000000006', 'run2-storage-disabled@example.test', 'authenticated', 'authenticated');

insert into public.companies (id, name) values
  ('5e2a0002-0000-4000-8000-00000000000a', 'Run2 Storage Co X'),
  ('5e2a0002-0000-4000-8000-00000000000b', 'Run2 Storage Co Y');

insert into public.company_members (company_id, user_id, role, status) values
  ('5e2a0002-0000-4000-8000-00000000000a', '5e2a0001-0000-4000-8000-000000000002', 'employee', 'active'),
  ('5e2a0002-0000-4000-8000-00000000000b', '5e2a0001-0000-4000-8000-000000000004', 'employee', 'active'),
  ('5e2a0002-0000-4000-8000-00000000000a', '5e2a0001-0000-4000-8000-000000000005', 'employee', 'invited'),
  ('5e2a0002-0000-4000-8000-00000000000a', '5e2a0001-0000-4000-8000-000000000006', 'employee', 'disabled');

insert into public.projects (id, owner_user_id, title, company_id) values
  ('5e2a0003-0000-4000-8000-000000000001', '5e2a0001-0000-4000-8000-000000000001',
   'Run2 Project P', '5e2a0002-0000-4000-8000-00000000000a');

insert into public.project_files (id, project_id, storage_path, filename, uploaded_by) values
  ('5e2a0004-0000-4000-8000-000000000001', '5e2a0003-0000-4000-8000-000000000001',
   '5e2a0003-0000-4000-8000-000000000001/run2-deliverable.pdf', 'run2-deliverable.pdf',
   '5e2a0001-0000-4000-8000-000000000001');

insert into public.work_orders (id, created_by, service_type, title, company_id) values
  ('5e2a0005-0000-4000-8000-000000000001', '5e2a0001-0000-4000-8000-000000000001',
   'logo', 'Run2 WO W', '5e2a0002-0000-4000-8000-00000000000a');

insert into public.work_order_attachments (id, work_order_id, storage_path, filename) values
  ('5e2a0006-0000-4000-8000-000000000001', '5e2a0005-0000-4000-8000-000000000001',
   '5e2a0005-0000-4000-8000-000000000001/run2-attachment.pdf', 'run2-attachment.pdf');

insert into public.digital_assets (id, title, storage_path, active) values
  ('5e2a0007-0000-4000-8000-000000000001', 'Run2 direct grant',  'run2-5e2a/direct.zip',   true),
  ('5e2a0007-0000-4000-8000-000000000002', 'Run2 company grant', 'run2-5e2a/company.zip',  true),
  ('5e2a0007-0000-4000-8000-000000000003', 'Run2 inactive',      'run2-5e2a/inactive.zip', false);

insert into public.asset_entitlements (asset_id, user_id, company_id, source) values
  ('5e2a0007-0000-4000-8000-000000000001', '5e2a0001-0000-4000-8000-000000000001', null, 'manual'),
  ('5e2a0007-0000-4000-8000-000000000002', null, '5e2a0002-0000-4000-8000-00000000000a', 'manual'),
  ('5e2a0007-0000-4000-8000-000000000003', '5e2a0001-0000-4000-8000-000000000001', null, 'manual');

-- Requires the runner role to INSERT into storage.objects with RLS bypassed
-- (true for the local `postgres` role). The digital-assets bucket is NOT
-- inserted here on purpose: it must come from 20261023000100.
insert into storage.objects (bucket_id, name) values
  ('digital-assets',         'run2-5e2a/direct.zip'),
  ('digital-assets',         'run2-5e2a/company.zip'),
  ('digital-assets',         'run2-5e2a/inactive.zip'),
  ('digital-assets',         'run2-5e2a/orphan.zip'),
  ('digital-assets',         'run2-5e2a/direct.zip.bak'),
  ('digital-assets',         'run2-5e2a/Direct.zip'),
  ('project-files',          'run2-5e2a/direct.zip'),
  ('project-files',          '5e2a0003-0000-4000-8000-000000000001/run2-deliverable.pdf'),
  ('work-order-attachments', '5e2a0005-0000-4000-8000-000000000001/run2-attachment.pdf');

-- -----------------------------------------------------------------------------
-- Catalog checks (T1, T2, T3, T11)
-- -----------------------------------------------------------------------------
select is(
  (select public from storage.buckets where id = 'digital-assets'),
  false,
  'T1: digital-assets bucket exists and is private'
);

-- M1: a pre-existing PUBLIC bucket must be forced private. Flip it public,
-- then re-run the exact bucket statement from 20261023000100.
update storage.buckets set public = true where id = 'digital-assets';
insert into storage.buckets (id, name, public)
  values ('digital-assets', 'digital-assets', false)
  on conflict (id) do update set public = false;

select is(
  (select public from storage.buckets where id = 'digital-assets'),
  false,
  'T1: re-running the bucket upsert forces an existing public digital-assets bucket private'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'digital_assets_storage_select_entitled'
      and cmd = 'SELECT' and roles = array['authenticated']::name[]
  ),
  'T1: digital_assets_storage_select_entitled is SELECT-only for authenticated'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd <> 'SELECT'
      and (policyname like 'digital_assets%'
           or coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%digital-assets%')),
  0,
  'T1: no INSERT/UPDATE/DELETE/ALL policy covers the digital-assets bucket'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'project_files_storage_select_owner_or_company'
      and cmd = 'SELECT' and roles = array['authenticated']::name[]
  ),
  'T11: project_files_storage_select_owner_or_company is SELECT-only for authenticated'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'wo_attachments_storage_select_owner_or_company'
      and cmd = 'SELECT' and roles = array['authenticated']::name[]
  ),
  'T11: wo_attachments_storage_select_owner_or_company is SELECT-only for authenticated'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname in ('project_files_storage_select_own', 'wo_attachments_storage_select_own')),
  0,
  'T11: the owner-only storage SELECT policies are gone'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('UPDATE', 'ALL')
      and coalesce(qual, '') || ' ' || coalesce(with_check, '')
          ~ '(project-files|work-order-attachments|digital-assets)'),
  0,
  'no UPDATE policy on storage.objects for project-files, work-order-attachments or digital-assets'
);

select ok(
  to_regclass('public.company_members_company_idx') is null,
  'T2: redundant company_members_company_idx is dropped'
);

select col_is_unique(
  'public', 'company_members', array['company_id', 'user_id']::name[],
  'T2: unique (company_id, user_id) still backs company_id lookups'
);

select is(
  (select indisunique from pg_index
    where indexrelid = to_regclass('public.project_files_storage_path_key')),
  true,
  'T3: project_files_storage_path_key is a unique index'
);

select is(
  (select indisunique from pg_index
    where indexrelid = to_regclass('public.digital_assets_storage_path_key')),
  true,
  'digital_assets_storage_path_key is a unique index'
);

select is(
  (select indisunique from pg_index
    where indexrelid = to_regclass('public.work_order_attachments_storage_path_key')),
  true,
  'work_order_attachments_storage_path_key is a unique index'
);

select throws_ok(
  $$ insert into public.digital_assets (title, storage_path, active)
     values ('Run2 duplicate path', 'run2-5e2a/direct.zip', true) $$,
  '23505', null,
  'a second digital_assets row for the same storage_path is rejected (no audience union)'
);

select throws_ok(
  $$ insert into public.work_order_attachments (work_order_id, storage_path, filename)
     values ('5e2a0005-0000-4000-8000-000000000001',
             '5e2a0005-0000-4000-8000-000000000001/run2-attachment.pdf', 'dup.pdf') $$,
  '23505', null,
  'a second work_order_attachments row for the same storage_path is rejected'
);

select throws_ok(
  $$ insert into public.project_files (project_id, storage_path, filename, uploaded_by)
     values ('5e2a0003-0000-4000-8000-000000000001',
             '5e2a0003-0000-4000-8000-000000000001/run2-deliverable.pdf',
             'dup.pdf', '5e2a0001-0000-4000-8000-000000000001') $$,
  '23505', null,
  'T3: a second project_files row for the same storage_path is rejected'
);

-- -----------------------------------------------------------------------------
-- As OWNER
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"5e2a0001-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select name from storage.objects
     where bucket_id = 'digital-assets' and name like 'run2-5e2a/%' order by name $$,
  $$ values ('run2-5e2a/direct.zip'::text) $$,
  'T1: direct grant reads only its active asset (inactive, orphan and decoys hidden)');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'digital-assets' and name = 'run2-5e2a/direct.zip.bak' $$,
  'T1: decoy with an extra suffix (direct.zip.bak) is denied');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'digital-assets' and name = 'run2-5e2a/Direct.zip' $$,
  'T1: decoy differing only in case (Direct.zip) is denied');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'project-files' and name = 'run2-5e2a/direct.zip' $$,
  'T1: the entitled name in a different bucket (project-files) is denied');

select results_eq(
  $$ select name from storage.objects
     where bucket_id = 'project-files' and name like '5e2a0003-%' $$,
  $$ values ('5e2a0003-0000-4000-8000-000000000001/run2-deliverable.pdf'::text) $$,
  'T11: project owner reads the deliverable object');

select results_eq(
  $$ select name from storage.objects
     where bucket_id = 'work-order-attachments' and name like '5e2a0005-%' $$,
  $$ values ('5e2a0005-0000-4000-8000-000000000001/run2-attachment.pdf'::text) $$,
  'T11: work order creator reads the attachment object');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('digital-assets', 'run2-5e2a/injected.zip') $$,
  '42501', null,
  'T1: an authenticated user cannot upload into digital-assets');

select is_empty(
  $$ update storage.objects set metadata = '{"run2_tamper": true}'::jsonb
     where bucket_id = 'project-files' and name like '5e2a0003-%' returning name $$,
  'T11: owner cannot update a deliverable object (no UPDATE policy)');

reset role;

-- -----------------------------------------------------------------------------
-- As MEMBER (active member of company X)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"5e2a0001-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$ select name from storage.objects
     where bucket_id = 'digital-assets' and name like 'run2-5e2a/%' order by name $$,
  $$ values ('run2-5e2a/company.zip'::text) $$,
  'T1: company grant reads only the company-entitled asset');

select results_eq(
  $$ select name from storage.objects
     where bucket_id = 'project-files' and name like '5e2a0003-%' $$,
  $$ values ('5e2a0003-0000-4000-8000-000000000001/run2-deliverable.pdf'::text) $$,
  'T11: active member of the project''s company reads the deliverable');

select results_eq(
  $$ select name from storage.objects
     where bucket_id = 'work-order-attachments' and name like '5e2a0005-%' $$,
  $$ values ('5e2a0005-0000-4000-8000-000000000001/run2-attachment.pdf'::text) $$,
  'T11: active member of the work order''s company reads the attachment');

select is_empty(
  $$ update storage.objects set metadata = '{"run2_tamper": true}'::jsonb
     where bucket_id = 'work-order-attachments' and name like '5e2a0005-%' returning name $$,
  'T11: company member cannot update an attachment object (read-only widening)');

reset role;

-- -----------------------------------------------------------------------------
-- As OUTSIDER (no membership, no grants)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"5e2a0001-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'digital-assets' and name like 'run2-5e2a/%' $$,
  'T1: non-entitled user reads no digital-assets objects');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'project-files' and name like '5e2a0003-%' $$,
  'T11: non-member cannot read the deliverable');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'work-order-attachments' and name like '5e2a0005-%' $$,
  'T11: non-member cannot read the attachment');

reset role;

-- -----------------------------------------------------------------------------
-- As OTHERCO (active member of a different company)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"5e2a0001-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'digital-assets' and name like 'run2-5e2a/%' $$,
  'T1: member of another company reads no digital-assets objects');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'project-files' and name like '5e2a0003-%' $$,
  'T11: member of a different company cannot read the deliverable');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'work-order-attachments' and name like '5e2a0005-%' $$,
  'T11: member of a different company cannot read the attachment');

reset role;

-- -----------------------------------------------------------------------------
-- As INVITED (membership row exists but is not active)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"5e2a0001-0000-4000-8000-000000000005","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'digital-assets' and name like 'run2-5e2a/%' $$,
  'T1: invited (inactive) member gets no company-granted assets');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'project-files' and name like '5e2a0003-%' $$,
  'T11: invited (inactive) member cannot read the deliverable');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'work-order-attachments' and name like '5e2a0005-%' $$,
  'T11: invited (inactive) member cannot read the attachment');

reset role;

-- -----------------------------------------------------------------------------
-- As DISABLED (membership row exists but is disabled)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"5e2a0001-0000-4000-8000-000000000006","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'digital-assets' and name like 'run2-5e2a/%' $$,
  'T1: disabled member gets no company-granted assets');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'project-files' and name like '5e2a0003-%' $$,
  'T11: disabled member cannot read the deliverable');

select is_empty(
  $$ select name from storage.objects
     where bucket_id = 'work-order-attachments' and name like '5e2a0005-%' $$,
  'T11: disabled member cannot read the attachment');

-- -----------------------------------------------------------------------------
-- Back to the owner role: confirm no write leaked through.
-- -----------------------------------------------------------------------------
reset role;

select is(
  (select count(*)::int from storage.objects
    where (bucket_id = 'digital-assets' and name like 'run2-5e2a/%')
       or (bucket_id = 'project-files' and name like '5e2a0003-%')
       or (bucket_id = 'work-order-attachments' and name like '5e2a0005-%')),
  8,
  'blocked writes left exactly the eight scoped fixture objects'
);

select is(
  (select count(*)::int from storage.objects
    where (bucket_id = 'project-files' and name like '5e2a0003-%'
           or bucket_id = 'work-order-attachments' and name like '5e2a0005-%')
      and jsonb_exists(metadata, 'run2_tamper')),
  0,
  'blocked updates left object metadata untouched'
);

select * from finish();
rollback;
