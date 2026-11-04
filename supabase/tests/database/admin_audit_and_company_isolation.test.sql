-- =============================================================================
-- pgTAP: admin_audit_log denials + admin-posted work isolation
-- Run: pnpm supabase test db   (requires the local Docker stack)
--
-- Already covered elsewhere (not repeated here):
--   rls_hardening.test.sql          per-user isolation on projects, work_orders, invoices
--   rls_files_attachments.test.sql  project_files + storage isolation
--
-- Fixtures (all rolled back):
--   user A  client the admin posts work for (created_by / user_id)
--   user B  unrelated signed-in user (member of company Y only)
--   user M  active employee of company X (admin-posted work carries company X)
--   Admin-posted shape, inserted as the migration owner (stands in for the
--   service role, which bypasses RLS):
--     work order  created_by = A, company_id = X
--     invoice     user_id = A, project_id = null
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, aud, role) values
  ('a1000000-0000-0000-0000-00000000000a', 'audit-a@example.test', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-00000000000b', 'audit-b@example.test', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-00000000000c', 'audit-m@example.test', 'authenticated', 'authenticated');

insert into public.companies (id, name) values
  ('a2000000-0000-0000-0000-0000000000a1', 'Audit Test Co X'),
  ('a2000000-0000-0000-0000-0000000000a2', 'Audit Test Co Y');

insert into public.company_members (company_id, user_id, role, status) values
  ('a2000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-00000000000a', 'employee', 'active'),
  ('a2000000-0000-0000-0000-0000000000a1', 'a1000000-0000-0000-0000-00000000000c', 'employee', 'active'),
  ('a2000000-0000-0000-0000-0000000000a2', 'a1000000-0000-0000-0000-00000000000b', 'employee', 'active');

insert into public.work_orders (id, created_by, company_id, service_type, title, status, quoted_amount_cents, quoted_at) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-00000000000a',
   'a2000000-0000-0000-0000-0000000000a1', 'logo', 'Admin-posted WO', 'quoted', 50000, now());

insert into public.invoices (id, project_id, user_id, amount_cents, status) values
  ('a4000000-0000-0000-0000-000000000001', null, 'a1000000-0000-0000-0000-00000000000a', 50000, 'open');

-- Seed one audit row as the owner so the select/update/delete denials below
-- are denied by the missing grant, not by an empty table.
insert into public.admin_audit_log (action, target_type, target_id)
  values ('work_order.create_for_client', 'work_order', 'a3000000-0000-0000-0000-000000000001');

-- -----------------------------------------------------------------------------
-- anon: grants revoked, so every statement fails with 42501 (not an empty set)
-- -----------------------------------------------------------------------------
set local role anon;

select throws_ok($$ select id from public.admin_audit_log $$, '42501', null,
  'anon cannot select admin_audit_log');
select throws_ok(
  $$ insert into public.admin_audit_log (action, target_type) values ('x', 'user') $$,
  '42501', null, 'anon cannot insert into admin_audit_log');
select throws_ok($$ update public.admin_audit_log set action = 'x' $$, '42501', null,
  'anon cannot update admin_audit_log');
select throws_ok($$ delete from public.admin_audit_log $$, '42501', null,
  'anon cannot delete from admin_audit_log');

-- -----------------------------------------------------------------------------
-- authenticated (user B): same denials
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok($$ select id from public.admin_audit_log $$, '42501', null,
  'authenticated cannot select admin_audit_log');
select throws_ok(
  $$ insert into public.admin_audit_log (action, target_type) values ('x', 'user') $$,
  '42501', null, 'authenticated cannot insert into admin_audit_log');
select throws_ok($$ update public.admin_audit_log set action = 'x' $$, '42501', null,
  'authenticated cannot update admin_audit_log');
select throws_ok($$ delete from public.admin_audit_log $$, '42501', null,
  'authenticated cannot delete from admin_audit_log');

-- -----------------------------------------------------------------------------
-- User B (other company): sees none of the admin-posted rows
-- -----------------------------------------------------------------------------
select is_empty($$ select id from public.work_orders $$,
  'other-company user cannot see the admin-posted work order');
select is_empty($$ select id from public.invoices $$,
  'other-company user cannot see the admin-posted no-project invoice');

-- -----------------------------------------------------------------------------
-- User A (client): sees both
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select results_eq(
  $$ select id from public.work_orders $$,
  $$ values ('a3000000-0000-0000-0000-000000000001'::uuid) $$,
  'client sees the admin-posted work order');
select results_eq(
  $$ select id from public.invoices $$,
  $$ values ('a4000000-0000-0000-0000-000000000001'::uuid) $$,
  'client sees the admin-posted no-project invoice');

-- -----------------------------------------------------------------------------
-- User M (active member of company X, not the creator)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select results_eq(
  $$ select id from public.work_orders $$,
  $$ values ('a3000000-0000-0000-0000-000000000001'::uuid) $$,
  'company member sees the admin-posted company work order');
select is_empty($$ select id from public.invoices $$,
  'company member does not see a no-project invoice owned by a colleague');

select * from finish();
rollback;
