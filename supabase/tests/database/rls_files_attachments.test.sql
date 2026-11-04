-- =============================================================================
-- pgTAP: RLS for project_files, work_order_attachments and their storage buckets
-- (20261022000100_rls_advisor_hardening.sql, 20261103000100, 20261103000200).
-- Run: pnpm supabase test db   (requires the local Docker stack)
--
-- Fixtures (all rolled back; buckets come from migrations):
--   user A  owns projects PA (company X) + PA2 (personal), work orders
--           WA (company X) + WA2 (personal); files PF1/PF2, attachments AT1/AT2
--   user B  unrelated signed-in user; owns work order WB (personal)
--   user C  active employee of company X
--   user E  invited (not active) employee of company X
--   user F  disabled employee of company X
--   decoy   project-files object named like AT1's path (cross-bucket check)
--
-- Former gaps, now closed:
--   GAP 1  storage SELECT widened to active company members (20261103000100).
--   GAP 2  owner storage DELETE on work-order-attachments dropped (20261103000200).
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(57);

-- -----------------------------------------------------------------------------
-- Fixtures (as the migration owner, bypassing RLS)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'rls-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'rls-b@example.test', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'rls-c@example.test', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'rls-e@example.test', 'authenticated', 'authenticated'),
  ('66666666-6666-6666-6666-666666666666', 'rls-f@example.test', 'authenticated', 'authenticated');

insert into public.companies (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'RLS Test Co');

insert into public.company_members (company_id, user_id, role, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'employee', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'employee', 'invited'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'employee', 'disabled');

insert into public.projects (id, owner_user_id, title, company_id) values
  ('b1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Project A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('b1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Project A2', null);

insert into public.project_files (id, project_id, storage_path, filename, uploaded_by) values
  ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000001/pf1.pdf', 'pf1.pdf', '11111111-1111-1111-1111-111111111111'),
  ('f1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002',
   'b1000000-0000-0000-0000-000000000002/pf2.pdf', 'pf2.pdf', '11111111-1111-1111-1111-111111111111');

insert into storage.objects (bucket_id, name) values
  ('project-files', 'b1000000-0000-0000-0000-000000000001/pf1.pdf'),
  ('project-files', 'b1000000-0000-0000-0000-000000000002/pf2.pdf');

insert into public.work_orders (id, created_by, service_type, title, company_id) values
  ('d1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'logo', 'WO A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('d1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'logo', 'WO A2', null),
  ('d1000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'logo', 'WO B', null);

insert into public.work_order_attachments (id, work_order_id, storage_path, filename) values
  ('a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001/at1.pdf', 'at1.pdf'),
  ('a1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002',
   'd1000000-0000-0000-0000-000000000002/at2.pdf', 'at2.pdf');

insert into storage.objects (bucket_id, name) values
  ('work-order-attachments', 'd1000000-0000-0000-0000-000000000001/at1.pdf'),
  ('work-order-attachments', 'd1000000-0000-0000-0000-000000000002/at2.pdf');

-- Decoy: a project-files object whose name equals AT1's attachment path. The
-- project-files policy must not match it via work_order_attachments.
insert into storage.objects (bucket_id, name) values
  ('project-files', 'd1000000-0000-0000-0000-000000000001/at1.pdf');

-- -----------------------------------------------------------------------------
-- Catalog checks
-- -----------------------------------------------------------------------------
select results_eq(
  $$ select policyname::text collate "default", cmd::text collate "default" from pg_policies
      where schemaname = 'public' and tablename = 'project_files' order by policyname $$,
  $$ values ('project_files_select_owner_or_company'::text, 'SELECT'::text) $$,
  'project_files has exactly one policy: owner-or-company SELECT');

select results_eq(
  $$ select policyname::text collate "default", cmd::text collate "default" from pg_policies
      where schemaname = 'public' and tablename = 'work_order_attachments' order by policyname $$,
  $$ values ('wo_att_insert_own'::text, 'INSERT'::text),
            ('wo_att_select_owner_or_company'::text, 'SELECT'::text) $$,
  'work_order_attachments has exactly INSERT-own and owner-or-company SELECT');

select results_eq(
  $$ select policyname::text collate "default", cmd::text collate "default" from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%project-files%'
      order by policyname $$,
  $$ values ('project_files_storage_select_owner_or_company'::text, 'SELECT'::text) $$,
  'project-files bucket has exactly one storage policy: owner-or-company SELECT');

select results_eq(
  $$ select policyname::text collate "default", cmd::text collate "default" from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and coalesce(qual, '') || ' ' || coalesce(with_check, '') like '%work-order-attachments%'
      order by policyname $$,
  $$ values ('wo_attachments_storage_insert_own'::text, 'INSERT'::text),
            ('wo_attachments_storage_select_owner_or_company'::text, 'SELECT'::text) $$,
  'work-order-attachments bucket has exactly insert-own and owner-or-company select policies (no delete)');

-- Allow-list: the COMPLETE set of policies on storage.objects. Cases 3 and 4 only
-- find policies whose text names one of these two buckets, so a new policy naming
-- neither would escape them. Adding, renaming or dropping ANY storage.objects
-- policy must update this list.
select results_eq(
  $$ select policyname::text collate "default", cmd::text collate "default" from pg_policies
      where schemaname = 'storage' and tablename = 'objects' order by policyname $$,
  $$ values ('digital_assets_storage_select_entitled'::text, 'SELECT'::text),
            ('project_files_storage_select_owner_or_company'::text, 'SELECT'::text),
            ('wo_attachments_storage_insert_own'::text, 'INSERT'::text),
            ('wo_attachments_storage_select_owner_or_company'::text, 'SELECT'::text) $$,
  'storage.objects has exactly the allow-listed policies (update this list when adding one)');

select ok(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'RLS is enabled on storage.objects');

-- -----------------------------------------------------------------------------
-- As user B (unrelated)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is_empty($$ select id from public.project_files $$,
  'B cannot select project_files');

select is_empty(
  $$ update public.project_files set filename = 'pwned.pdf'
     where id = 'f1000000-0000-0000-0000-000000000001' returning id $$,
  'B cannot update project_files');

select is_empty(
  $$ delete from public.project_files
     where id = 'f1000000-0000-0000-0000-000000000001' returning id $$,
  'B cannot delete project_files');

select throws_ok(
  $$ insert into public.project_files (project_id, storage_path, filename, uploaded_by)
     values ('b1000000-0000-0000-0000-000000000001',
             'b1000000-0000-0000-0000-000000000001/b.pdf', 'b.pdf',
             '22222222-2222-2222-2222-222222222222') $$,
  '42501', null,
  'B cannot insert project_files');

select is_empty($$ select id from public.work_order_attachments $$,
  'B cannot select work_order_attachments');

select is_empty(
  $$ update public.work_order_attachments set filename = 'pwned.pdf'
     where id = 'a1000000-0000-0000-0000-000000000001' returning id $$,
  'B cannot update work_order_attachments');

select is_empty(
  $$ delete from public.work_order_attachments
     where id = 'a1000000-0000-0000-0000-000000000001' returning id $$,
  'B cannot delete work_order_attachments');

select throws_ok(
  $$ insert into public.work_order_attachments (work_order_id, storage_path, filename)
     values ('d1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000001/b.pdf', 'b.pdf') $$,
  '42501', null,
  'B cannot attach to another user''s work order');

select is_empty(
  $$ select name from storage.objects where bucket_id = 'project-files' $$,
  'B cannot select project-files objects');

select is_empty(
  $$ select name from storage.objects where bucket_id = 'work-order-attachments' $$,
  'B cannot select work-order-attachments objects');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('work-order-attachments', 'd1000000-0000-0000-0000-000000000001/evil.pdf') $$,
  '42501', null,
  'B cannot upload into another user''s work-order folder');

-- storage.protect_delete() is a statement-level trigger that raises 42501 for any direct
-- DELETE unless this flag is set. set_config(..., true) is transaction-local and stays on
-- for the rest of the transaction; set it so RLS (not the trigger) is what is tested.
select set_config('storage.allow_delete_query', 'true', true);

select is_empty(
  $$ delete from storage.objects
     where bucket_id = 'work-order-attachments'
       and name = 'd1000000-0000-0000-0000-000000000001/at1.pdf' returning name $$,
  'B cannot delete another user''s work-order attachment object');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('project-files', 'b1000000-0000-0000-0000-000000000001/evil.pdf') $$,
  '42501', null,
  'B cannot upload into project-files');

select is_empty(
  $$ update storage.objects set metadata = '{"x":1}'::jsonb
     where bucket_id = 'work-order-attachments'
       and name = 'd1000000-0000-0000-0000-000000000001/at1.pdf' returning name $$,
  'B cannot update work-order-attachments object metadata');

select is_empty(
  $$ update storage.objects set metadata = '{"x":1}'::jsonb
     where bucket_id = 'project-files'
       and name = 'b1000000-0000-0000-0000-000000000001/pf1.pdf' returning name $$,
  'B cannot update project-files object metadata');

-- -----------------------------------------------------------------------------
-- As user C (active member of company X)
-- -----------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select results_eq(
  $$ select id from public.project_files order by id $$,
  $$ values ('f1000000-0000-0000-0000-000000000001'::uuid) $$,
  'company member reads only company-scoped project_files');

select results_eq(
  $$ select id from public.work_order_attachments order by id $$,
  $$ values ('a1000000-0000-0000-0000-000000000001'::uuid) $$,
  'company member reads only company-scoped work_order_attachments');

-- Fixed by migration 20261103000100 (was GAP 1).
select results_eq(
  $$ select name from storage.objects
     where bucket_id = 'project-files' order by name $$,
  $$ values ('b1000000-0000-0000-0000-000000000001/pf1.pdf'::text) $$,
  'company member can select only the company project-files object (not PF2)');

-- Fixed by migration 20261103000100 (was GAP 1).
select results_eq(
  $$ select name from storage.objects
     where bucket_id = 'work-order-attachments' order by name $$,
  $$ values ('d1000000-0000-0000-0000-000000000001/at1.pdf'::text) $$,
  'company member can select only the company work-order-attachments object (not AT2)');

select is_empty(
  $$ select name from storage.objects
     where name in ('b1000000-0000-0000-0000-000000000002/pf2.pdf',
                    'd1000000-0000-0000-0000-000000000002/at2.pdf') $$,
  'company member cannot select PF2/AT2 objects (no-company rows do not leak)');

select is_empty(
  $$ update public.project_files set filename = 'pwned.pdf'
     where id = 'f1000000-0000-0000-0000-000000000001' returning id $$,
  'company member cannot update project_files');

select is_empty(
  $$ delete from public.work_order_attachments
     where id = 'a1000000-0000-0000-0000-000000000001' returning id $$,
  'company member cannot delete work_order_attachments');

select throws_ok(
  $$ insert into public.work_order_attachments (work_order_id, storage_path, filename)
     values ('d1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000001/c.pdf', 'c.pdf') $$,
  '42501', null,
  'company member cannot attach to the company work order');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('work-order-attachments', 'd1000000-0000-0000-0000-000000000001/c.pdf') $$,
  '42501', null,
  'company member cannot upload into the company work-order folder');

-- -----------------------------------------------------------------------------
-- As user E (invited, not active)
-- -----------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);

select is_empty($$ select id from public.project_files $$,
  'invited member cannot select project_files');

select is_empty($$ select id from public.work_order_attachments $$,
  'invited member cannot select work_order_attachments');

select is_empty(
  $$ select name from storage.objects where bucket_id = 'project-files' $$,
  'invited member cannot select project-files objects');

select is_empty(
  $$ select name from storage.objects where bucket_id = 'work-order-attachments' $$,
  'invited member cannot select work-order-attachments objects');

-- -----------------------------------------------------------------------------
-- As user F (disabled employee of company X)
-- -----------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);

select is_empty(
  $$ select id from public.project_files
     union all select id from public.work_order_attachments $$,
  'disabled member cannot select project_files or work_order_attachments');

select is_empty(
  $$ select name from storage.objects
     where bucket_id in ('project-files', 'work-order-attachments') $$,
  'disabled member cannot select any file objects');

-- -----------------------------------------------------------------------------
-- As user A (owner)
-- -----------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select results_eq(
  $$ select id from public.project_files order by id $$,
  $$ values ('f1000000-0000-0000-0000-000000000001'::uuid),
            ('f1000000-0000-0000-0000-000000000002'::uuid) $$,
  'owner reads own project_files');

select results_eq(
  $$ select id from public.work_order_attachments order by id $$,
  $$ values ('a1000000-0000-0000-0000-000000000001'::uuid),
            ('a1000000-0000-0000-0000-000000000002'::uuid) $$,
  'owner reads own work_order_attachments');

select results_eq(
  $$ select name from storage.objects where bucket_id = 'project-files' order by name $$,
  $$ values ('b1000000-0000-0000-0000-000000000001/pf1.pdf'::text),
            ('b1000000-0000-0000-0000-000000000002/pf2.pdf'::text) $$,
  'owner reads own project-files objects');

select results_eq(
  $$ select name from storage.objects where bucket_id = 'work-order-attachments' order by name $$,
  $$ values ('d1000000-0000-0000-0000-000000000001/at1.pdf'::text),
            ('d1000000-0000-0000-0000-000000000002/at2.pdf'::text) $$,
  'owner reads own work-order-attachments objects');

select throws_ok(
  $$ insert into public.project_files (project_id, storage_path, filename, uploaded_by)
     values ('b1000000-0000-0000-0000-000000000001',
             'b1000000-0000-0000-0000-000000000001/new.pdf', 'new.pdf',
             '11111111-1111-1111-1111-111111111111') $$,
  '42501', null,
  'owner cannot insert project_files (service role only)');

select is_empty(
  $$ update public.project_files set filename = 'renamed.pdf'
     where id = 'f1000000-0000-0000-0000-000000000001' returning id $$,
  'owner cannot update project_files');

select is_empty(
  $$ delete from public.project_files
     where id = 'f1000000-0000-0000-0000-000000000001' returning id $$,
  'owner cannot delete project_files');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('project-files', 'b1000000-0000-0000-0000-000000000001/new.pdf') $$,
  '42501', null,
  'owner cannot upload into project-files (service role only)');

-- storage.protect_delete() is a statement-level trigger that raises 42501 for any direct
-- DELETE unless this flag is set. set_config(..., true) is transaction-local and stays on
-- for the rest of the transaction; set it so RLS (not the trigger) is what is tested.
select set_config('storage.allow_delete_query', 'true', true);

select is_empty(
  $$ delete from storage.objects
     where bucket_id = 'project-files'
       and name = 'b1000000-0000-0000-0000-000000000001/pf1.pdf' returning name $$,
  'owner cannot delete project-files objects');

select lives_ok(
  $$ insert into public.work_order_attachments (work_order_id, storage_path, filename)
     values ('d1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000001/new.pdf', 'new.pdf') $$,
  'owner can attach to own work order');

select throws_ok(
  $$ insert into public.work_order_attachments (work_order_id, storage_path, filename)
     values ('d1000000-0000-0000-0000-000000000001',
             'd1000000-0000-0000-0000-000000000002/new.pdf', 'new.pdf') $$,
  '42501', null,
  'owner cannot attach with a path outside the work order folder');

select throws_ok(
  $$ insert into public.work_order_attachments (work_order_id, storage_path, filename)
     values ('d1000000-0000-0000-0000-000000000003',
             'd1000000-0000-0000-0000-000000000003/x.pdf', 'x.pdf') $$,
  '42501', null,
  'owner cannot attach to another user''s work order');

select is_empty(
  $$ update public.work_order_attachments set filename = 'renamed.pdf'
     where id = 'a1000000-0000-0000-0000-000000000001' returning id $$,
  'owner cannot update work_order_attachments');

select is_empty(
  $$ delete from public.work_order_attachments
     where id = 'a1000000-0000-0000-0000-000000000001' returning id $$,
  'owner cannot delete work_order_attachments rows');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('work-order-attachments', 'd1000000-0000-0000-0000-000000000001/new.pdf') $$,
  'owner can upload into own work-order folder');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('work-order-attachments', 'd1000000-0000-0000-0000-000000000003/x.pdf') $$,
  '42501', null,
  'owner cannot upload into another user''s work-order folder');

-- Fixed by migration 20261103000200 (was GAP 2): the object is no longer deletable either.
-- storage.protect_delete() is a statement-level trigger that raises 42501 for any direct
-- DELETE unless this flag is set. set_config(..., true) is transaction-local and stays on
-- for the rest of the transaction; set it so RLS (not the trigger) is what is tested.
select set_config('storage.allow_delete_query', 'true', true);

select is_empty(
  $$ delete from storage.objects
     where bucket_id = 'work-order-attachments'
       and name = 'd1000000-0000-0000-0000-000000000002/at2.pdf' returning name $$,
  'owner cannot delete a work-order attachment object');

select is_empty(
  $$ update storage.objects set metadata = '{"x":1}'::jsonb
     where bucket_id = 'work-order-attachments'
       and name = 'd1000000-0000-0000-0000-000000000001/at1.pdf' returning name $$,
  'owner cannot update work-order-attachments object metadata');

-- -----------------------------------------------------------------------------
-- Back to the owner role: confirm only the sanctioned writes landed.
-- -----------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select id, filename from public.project_files order by id $$,
  $$ values ('f1000000-0000-0000-0000-000000000001'::uuid, 'pf1.pdf'::text),
            ('f1000000-0000-0000-0000-000000000002'::uuid, 'pf2.pdf'::text) $$,
  'project_files unchanged: PF1 and PF2 only, original filenames');

select results_eq(
  $$ select storage_path from public.work_order_attachments order by storage_path $$,
  $$ values ('d1000000-0000-0000-0000-000000000001/at1.pdf'::text),
            ('d1000000-0000-0000-0000-000000000001/new.pdf'::text),
            ('d1000000-0000-0000-0000-000000000002/at2.pdf'::text) $$,
  'work_order_attachments holds AT1, AT2 and the new owner row');

select results_eq(
  $$ select name from storage.objects
      where bucket_id in ('project-files', 'work-order-attachments') order by name $$,
  $$ values ('b1000000-0000-0000-0000-000000000001/pf1.pdf'::text),
            ('b1000000-0000-0000-0000-000000000002/pf2.pdf'::text),
            ('d1000000-0000-0000-0000-000000000001/at1.pdf'::text),
            ('d1000000-0000-0000-0000-000000000001/at1.pdf'::text),
            ('d1000000-0000-0000-0000-000000000001/new.pdf'::text),
            ('d1000000-0000-0000-0000-000000000002/at2.pdf'::text) $$,
  'storage holds PF1, PF2, AT1 (plus its project-files decoy), AT2 and the new object');

select * from finish();
rollback;
