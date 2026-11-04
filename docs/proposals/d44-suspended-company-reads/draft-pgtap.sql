-- =============================================================================
-- DRAFT pgTAP (D44): suspended-company members lose company-scoped reads.
-- Suggested file: supabase/tests/database/suspended_company_reads.test.sql
-- Run after draft-migration.sql: pnpm supabase test db
--
-- Fixtures (all rolled back):
--   O   owns every fixture row, not a member of anything
--   MA  active member of ACT (active company)
--   MS  active member of SUS (suspended company); also CREATED one SUS work order
--   MD  disabled member of ACT
--   N   signed-in non-member
--   Each company has: project, project file, invoice, work order, attachment,
--   company-entitled digital asset, and the three storage objects.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(73);

insert into auth.users (id, email, aud, role) values
  ('d4400000-0000-4000-8000-000000000001', 'd44-o@example.test', 'authenticated', 'authenticated'),
  ('d4400000-0000-4000-8000-000000000002', 'd44-ma@example.test', 'authenticated', 'authenticated'),
  ('d4400000-0000-4000-8000-000000000003', 'd44-ms@example.test', 'authenticated', 'authenticated'),
  ('d4400000-0000-4000-8000-000000000004', 'd44-n@example.test', 'authenticated', 'authenticated'),
  ('d4400000-0000-4000-8000-000000000005', 'd44-md@example.test', 'authenticated', 'authenticated');

insert into public.companies (id, name, status) values
  ('d4400000-0000-4000-8000-0000000000a1', 'D44 Active Co', 'active'),
  ('d4400000-0000-4000-8000-0000000000a2', 'D44 Suspended Co', 'suspended');

insert into public.company_members (company_id, user_id, role, status) values
  ('d4400000-0000-4000-8000-0000000000a1', 'd4400000-0000-4000-8000-000000000002', 'employee', 'active'),
  ('d4400000-0000-4000-8000-0000000000a2', 'd4400000-0000-4000-8000-000000000003', 'employee', 'active'),
  ('d4400000-0000-4000-8000-0000000000a1', 'd4400000-0000-4000-8000-000000000005', 'employee', 'disabled');

insert into public.projects (id, owner_user_id, title, company_id) values
  ('d4410000-0000-4000-8000-000000000001', 'd4400000-0000-4000-8000-000000000001', 'D44 ACT project', 'd4400000-0000-4000-8000-0000000000a1'),
  ('d4410000-0000-4000-8000-000000000002', 'd4400000-0000-4000-8000-000000000001', 'D44 SUS project', 'd4400000-0000-4000-8000-0000000000a2');

insert into public.project_files (id, project_id, storage_path, filename, uploaded_by) values
  ('d4420000-0000-4000-8000-000000000001', 'd4410000-0000-4000-8000-000000000001', 'd44/act/pf.pdf', 'pf.pdf', 'd4400000-0000-4000-8000-000000000001'),
  ('d4420000-0000-4000-8000-000000000002', 'd4410000-0000-4000-8000-000000000002', 'd44/sus/pf.pdf', 'pf.pdf', 'd4400000-0000-4000-8000-000000000001');

insert into public.invoices (id, project_id, user_id, amount_cents) values
  ('d4430000-0000-4000-8000-000000000001', 'd4410000-0000-4000-8000-000000000001', 'd4400000-0000-4000-8000-000000000001', 10000),
  ('d4430000-0000-4000-8000-000000000002', 'd4410000-0000-4000-8000-000000000002', 'd4400000-0000-4000-8000-000000000001', 10000);

insert into public.work_orders (id, created_by, service_type, title, company_id) values
  ('d4440000-0000-4000-8000-000000000001', 'd4400000-0000-4000-8000-000000000001', 'logo', 'D44 ACT WO', 'd4400000-0000-4000-8000-0000000000a1'),
  ('d4440000-0000-4000-8000-000000000002', 'd4400000-0000-4000-8000-000000000001', 'logo', 'D44 SUS WO', 'd4400000-0000-4000-8000-0000000000a2'),
  ('d4440000-0000-4000-8000-000000000009', 'd4400000-0000-4000-8000-000000000003', 'logo', 'D44 SUS WO created by MS', 'd4400000-0000-4000-8000-0000000000a2');

insert into public.work_order_attachments (id, work_order_id, storage_path, filename) values
  ('d4450000-0000-4000-8000-000000000001', 'd4440000-0000-4000-8000-000000000001', 'd44/act/at.pdf', 'at.pdf'),
  ('d4450000-0000-4000-8000-000000000002', 'd4440000-0000-4000-8000-000000000002', 'd44/sus/at.pdf', 'at.pdf');

insert into public.digital_assets (id, title, storage_path, active) values
  ('d4460000-0000-4000-8000-000000000001', 'D44 ACT asset', 'd44/act/asset.zip', true),
  ('d4460000-0000-4000-8000-000000000002', 'D44 SUS asset', 'd44/sus/asset.zip', true);

insert into public.asset_entitlements (asset_id, user_id, company_id, source) values
  ('d4460000-0000-4000-8000-000000000001', null, 'd4400000-0000-4000-8000-0000000000a1', 'manual'),
  ('d4460000-0000-4000-8000-000000000002', null, 'd4400000-0000-4000-8000-0000000000a2', 'manual');

insert into storage.objects (bucket_id, name) values
  ('project-files', 'd44/act/pf.pdf'),
  ('work-order-attachments', 'd44/act/at.pdf'),
  ('digital-assets', 'd44/act/asset.zip'),
  ('project-files', 'd44/sus/pf.pdf'),
  ('work-order-attachments', 'd44/sus/at.pdf'),
  ('digital-assets', 'd44/sus/asset.zip');

set local role authenticated;

-- 1. active-company member reads ACT rows
select set_config('request.jwt.claims', '{"sub":"d4400000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.projects where id = 'd4410000-0000-4000-8000-000000000001'), 1, 'active member reads ACT: projects');
select is((select count(*)::int from public.project_files where id = 'd4420000-0000-4000-8000-000000000001'), 1, 'active member reads ACT: project_files');
select is((select count(*)::int from public.invoices where id = 'd4430000-0000-4000-8000-000000000001'), 1, 'active member reads ACT: invoices');
select is((select count(*)::int from public.work_orders where id = 'd4440000-0000-4000-8000-000000000001'), 1, 'active member reads ACT: work_orders');
select is((select count(*)::int from public.work_order_attachments where id = 'd4450000-0000-4000-8000-000000000001'), 1, 'active member reads ACT: work_order_attachments');
select is((select count(*)::int from public.digital_assets where id = 'd4460000-0000-4000-8000-000000000001'), 1, 'active member reads ACT: digital_assets');
select is((select count(*)::int from public.asset_entitlements where asset_id = 'd4460000-0000-4000-8000-000000000001'), 1, 'active member reads ACT: asset_entitlements');
select is((select count(*)::int from storage.objects where bucket_id = 'project-files' and name = 'd44/act/pf.pdf'), 1, 'active member reads ACT: storage project-files');
select is((select count(*)::int from storage.objects where bucket_id = 'work-order-attachments' and name = 'd44/act/at.pdf'), 1, 'active member reads ACT: storage work-order-attachments');
select is((select count(*)::int from storage.objects where bucket_id = 'digital-assets' and name = 'd44/act/asset.zip'), 1, 'active member reads ACT: storage digital-assets');

-- 2. suspended-company member is denied SUS rows
select set_config('request.jwt.claims', '{"sub":"d4400000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.projects where id = 'd4410000-0000-4000-8000-000000000002'), 0, 'suspended member denied SUS: projects');
select is((select count(*)::int from public.project_files where id = 'd4420000-0000-4000-8000-000000000002'), 0, 'suspended member denied SUS: project_files');
select is((select count(*)::int from public.invoices where id = 'd4430000-0000-4000-8000-000000000002'), 0, 'suspended member denied SUS: invoices');
select is((select count(*)::int from public.work_orders where id = 'd4440000-0000-4000-8000-000000000002'), 0, 'suspended member denied SUS: work_orders');
select is((select count(*)::int from public.work_order_attachments where id = 'd4450000-0000-4000-8000-000000000002'), 0, 'suspended member denied SUS: work_order_attachments');
select is((select count(*)::int from public.digital_assets where id = 'd4460000-0000-4000-8000-000000000002'), 0, 'suspended member denied SUS: digital_assets');
select is((select count(*)::int from public.asset_entitlements where asset_id = 'd4460000-0000-4000-8000-000000000002'), 0, 'suspended member denied SUS: asset_entitlements');
select is((select count(*)::int from storage.objects where bucket_id = 'project-files' and name = 'd44/sus/pf.pdf'), 0, 'suspended member denied SUS: storage project-files');
select is((select count(*)::int from storage.objects where bucket_id = 'work-order-attachments' and name = 'd44/sus/at.pdf'), 0, 'suspended member denied SUS: storage work-order-attachments');
select is((select count(*)::int from storage.objects where bucket_id = 'digital-assets' and name = 'd44/sus/asset.zip'), 0, 'suspended member denied SUS: storage digital-assets');

-- 3. non-member and disabled member are denied ACT rows
select set_config('request.jwt.claims', '{"sub":"d4400000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select count(*)::int from public.projects where id = 'd4410000-0000-4000-8000-000000000001'), 0, 'non-member denied ACT: projects');
select is((select count(*)::int from public.project_files where id = 'd4420000-0000-4000-8000-000000000001'), 0, 'non-member denied ACT: project_files');
select is((select count(*)::int from public.invoices where id = 'd4430000-0000-4000-8000-000000000001'), 0, 'non-member denied ACT: invoices');
select is((select count(*)::int from public.work_orders where id = 'd4440000-0000-4000-8000-000000000001'), 0, 'non-member denied ACT: work_orders');
select is((select count(*)::int from public.work_order_attachments where id = 'd4450000-0000-4000-8000-000000000001'), 0, 'non-member denied ACT: work_order_attachments');
select is((select count(*)::int from public.digital_assets where id = 'd4460000-0000-4000-8000-000000000001'), 0, 'non-member denied ACT: digital_assets');
select is((select count(*)::int from public.asset_entitlements where asset_id = 'd4460000-0000-4000-8000-000000000001'), 0, 'non-member denied ACT: asset_entitlements');
select is((select count(*)::int from storage.objects where bucket_id = 'project-files' and name = 'd44/act/pf.pdf'), 0, 'non-member denied ACT: storage project-files');
select is((select count(*)::int from storage.objects where bucket_id = 'work-order-attachments' and name = 'd44/act/at.pdf'), 0, 'non-member denied ACT: storage work-order-attachments');
select is((select count(*)::int from storage.objects where bucket_id = 'digital-assets' and name = 'd44/act/asset.zip'), 0, 'non-member denied ACT: storage digital-assets');
select set_config('request.jwt.claims', '{"sub":"d4400000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select count(*)::int from public.projects where id = 'd4410000-0000-4000-8000-000000000001'), 0, 'disabled member denied ACT: projects');
select is((select count(*)::int from public.project_files where id = 'd4420000-0000-4000-8000-000000000001'), 0, 'disabled member denied ACT: project_files');
select is((select count(*)::int from public.invoices where id = 'd4430000-0000-4000-8000-000000000001'), 0, 'disabled member denied ACT: invoices');
select is((select count(*)::int from public.work_orders where id = 'd4440000-0000-4000-8000-000000000001'), 0, 'disabled member denied ACT: work_orders');
select is((select count(*)::int from public.work_order_attachments where id = 'd4450000-0000-4000-8000-000000000001'), 0, 'disabled member denied ACT: work_order_attachments');
select is((select count(*)::int from public.digital_assets where id = 'd4460000-0000-4000-8000-000000000001'), 0, 'disabled member denied ACT: digital_assets');
select is((select count(*)::int from public.asset_entitlements where asset_id = 'd4460000-0000-4000-8000-000000000001'), 0, 'disabled member denied ACT: asset_entitlements');
select is((select count(*)::int from storage.objects where bucket_id = 'project-files' and name = 'd44/act/pf.pdf'), 0, 'disabled member denied ACT: storage project-files');
select is((select count(*)::int from storage.objects where bucket_id = 'work-order-attachments' and name = 'd44/act/at.pdf'), 0, 'disabled member denied ACT: storage work-order-attachments');
select is((select count(*)::int from storage.objects where bucket_id = 'digital-assets' and name = 'd44/act/asset.zip'), 0, 'disabled member denied ACT: storage digital-assets');

-- 4. active member of ACT does not see SUS rows (cross-company)
select set_config('request.jwt.claims', '{"sub":"d4400000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.projects where id = 'd4410000-0000-4000-8000-000000000002'), 0, 'ACT member denied SUS: projects');
select is((select count(*)::int from public.project_files where id = 'd4420000-0000-4000-8000-000000000002'), 0, 'ACT member denied SUS: project_files');
select is((select count(*)::int from public.invoices where id = 'd4430000-0000-4000-8000-000000000002'), 0, 'ACT member denied SUS: invoices');
select is((select count(*)::int from public.work_orders where id = 'd4440000-0000-4000-8000-000000000002'), 0, 'ACT member denied SUS: work_orders');
select is((select count(*)::int from public.work_order_attachments where id = 'd4450000-0000-4000-8000-000000000002'), 0, 'ACT member denied SUS: work_order_attachments');
select is((select count(*)::int from public.digital_assets where id = 'd4460000-0000-4000-8000-000000000002'), 0, 'ACT member denied SUS: digital_assets');
select is((select count(*)::int from public.asset_entitlements where asset_id = 'd4460000-0000-4000-8000-000000000002'), 0, 'ACT member denied SUS: asset_entitlements');
select is((select count(*)::int from storage.objects where bucket_id = 'project-files' and name = 'd44/sus/pf.pdf'), 0, 'ACT member denied SUS: storage project-files');
select is((select count(*)::int from storage.objects where bucket_id = 'work-order-attachments' and name = 'd44/sus/at.pdf'), 0, 'ACT member denied SUS: storage work-order-attachments');
select is((select count(*)::int from storage.objects where bucket_id = 'digital-assets' and name = 'd44/sus/asset.zip'), 0, 'ACT member denied SUS: storage digital-assets');

-- 5. suspended member keeps what the memo says stays (as MS)
select set_config('request.jwt.claims', '{"sub":"d4400000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((select count(*) from public.work_orders where id = 'd4440000-0000-4000-8000-000000000009')::int, 1, 'suspended member still reads the SUS work order they created (created_by branch)');
select is((select count(*) from public.companies where id = 'd4400000-0000-4000-8000-0000000000a2')::int, 1, 'suspended member still reads the SUS company row (companies_select_member unchanged; /company suspended notice depends on it)');
select is((select status from public.companies where id = 'd4400000-0000-4000-8000-0000000000a2'), 'suspended', 'suspended member sees status = suspended');
select is((select count(*) from public.company_members where user_id = 'd4400000-0000-4000-8000-000000000003' and company_id = 'd4400000-0000-4000-8000-0000000000a2')::int, 1, 'suspended member still reads their own company_members row');
select is((select count(*) from public.company_members where company_id = 'd4400000-0000-4000-8000-0000000000a2')::int, 1, 'suspended member sees only their own membership row (co-member visibility gated)');
select lives_ok(
  $$ insert into public.work_orders (created_by, service_type, title, company_id)
     values ('d4400000-0000-4000-8000-000000000003', 'logo', 'D44 insert while suspended', 'd4400000-0000-4000-8000-0000000000a2') $$,
  'wo_insert_own is unchanged: a suspended member can still insert a work order for their company (separate decision, see memo)');

-- 6. helper behaviour (as MS / MA)
select is(public.is_active_company_member('d4400000-0000-4000-8000-0000000000a2'), false, 'is_active_company_member false for suspended company');
select is(public.is_company_member('d4400000-0000-4000-8000-0000000000a2'), true, 'is_company_member unchanged (membership only)');
select set_config('request.jwt.claims', '{"sub":"d4400000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.is_active_company_member('d4400000-0000-4000-8000-0000000000a1'), true, 'is_active_company_member true for active company member');

reset role;

-- 7. helper metadata
select ok((select prosecdef from pg_proc where oid = 'public.is_active_company_member(uuid)'::regprocedure), 'helper is SECURITY DEFINER');
select ok((select 'search_path=pg_catalog, public, pg_temp' = any (proconfig) from pg_proc where oid = 'public.is_active_company_member(uuid)'::regprocedure), 'helper pins search_path');
select ok(not has_function_privilege('anon', 'public.is_active_company_member(uuid)', 'execute'), 'anon cannot execute the helper');
select ok(has_function_privilege('authenticated', 'public.is_active_company_member(uuid)', 'execute'), 'authenticated can execute the helper');

-- 8. policy-set pinning (L-006 casts, L-024)
select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'public' and tablename = 'projects' $$,
  $$ values
       ('projects_select_owner_or_company'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'projects has exactly the expected policy set');

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'public' and tablename = 'project_files' $$,
  $$ values
       ('project_files_select_owner_or_company'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'project_files has exactly the expected policy set');

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'public' and tablename = 'invoices' $$,
  $$ values
       ('invoices_select_owner_or_company'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'invoices has exactly the expected policy set');

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'public' and tablename = 'work_orders' $$,
  $$ values
       ('wo_select_owner_or_company'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default"),
       ('wo_insert_own'::text collate "default", 'INSERT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'work_orders has exactly the expected policy set');

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'public' and tablename = 'work_order_attachments' $$,
  $$ values
       ('wo_att_select_owner_or_company'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default"),
       ('wo_att_insert_own'::text collate "default", 'INSERT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'work_order_attachments has exactly the expected policy set');

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'public' and tablename = 'digital_assets' $$,
  $$ values
       ('digital_assets_select_active'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'digital_assets has exactly the expected policy set');

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'public' and tablename = 'asset_entitlements' $$,
  $$ values
       ('asset_entitlements_select_entitled'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'asset_entitlements has exactly the expected policy set');

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'public' and tablename = 'companies' $$,
  $$ values
       ('companies_select_member'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'companies has exactly the expected policy set');

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'public' and tablename = 'company_members' $$,
  $$ values
       ('company_members_select_comember'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default"),
       ('company_members_admin_insert'::text collate "default", 'INSERT'::text collate "default", 'PERMISSIVE'::text collate "default"),
       ('company_members_admin_update'::text collate "default", 'UPDATE'::text collate "default", 'PERMISSIVE'::text collate "default"),
       ('company_members_admin_delete'::text collate "default", 'DELETE'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'company_members has exactly the expected policy set');

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies where schemaname = 'storage' and tablename = 'objects' $$,
  $$ values
       ('digital_assets_storage_select_entitled'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default"),
       ('project_files_storage_select_owner_or_company'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default"),
       ('wo_attachments_storage_insert_own'::text collate "default", 'INSERT'::text collate "default", 'PERMISSIVE'::text collate "default"),
       ('wo_attachments_storage_select_owner_or_company'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'storage.objects has exactly the expected policy set');

select * from finish();
rollback;