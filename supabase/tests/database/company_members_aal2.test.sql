-- =============================================================================
-- pgTAP: company_members client writes require AAL2 + an active company
-- (20261104000200_company_members_admin_aal2.sql, D42)
-- Run: pnpm supabase test db   (requires the local Docker stack)
--
-- Fixtures (all rolled back):
--   company ACT (active):     A1 company_admin, M employee (plain member)
--   company SUS (suspended):  A2 company_admin, S employee
--   I: invitee user (no membership)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

insert into auth.users (id, email, aud, role) values
  ('a1000000-0000-0000-0000-000000000001', 'aal2-a1@example.test', 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-000000000002', 'aal2-a2@example.test', 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-000000000003', 'aal2-m@example.test', 'authenticated', 'authenticated'),
  ('a4000000-0000-0000-0000-000000000004', 'aal2-s@example.test', 'authenticated', 'authenticated'),
  ('a5000000-0000-0000-0000-000000000005', 'aal2-i@example.test', 'authenticated', 'authenticated');

insert into public.companies (id, name, status) values
  ('c1000000-0000-0000-0000-000000000001', 'AAL2 Active Co', 'active'),
  ('c2000000-0000-0000-0000-000000000002', 'AAL2 Suspended Co', 'suspended');

insert into public.company_roles (key, label, rank) values ('aal2_test_super', 'AAL2 Test Super', 200);

insert into public.company_members (company_id, user_id, role, status) values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'company_admin', 'active'),
  ('c1000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'employee', 'active'),
  ('c2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'company_admin', 'active'),
  ('c2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000004', 'employee', 'active');

-- -----------------------------------------------------------------------------
-- 8. Helper metadata
-- -----------------------------------------------------------------------------
select ok(
  (select prosecdef from pg_proc where oid = 'public.can_manage_company_members(uuid)'::regprocedure),
  'helper is SECURITY DEFINER');

select ok(
  (select 'search_path=pg_catalog, public, pg_temp' = any (proconfig)
     from pg_proc where oid = 'public.can_manage_company_members(uuid)'::regprocedure),
  'helper pins search_path = pg_catalog, public, pg_temp');

select ok(
  not has_function_privilege('anon', 'public.can_manage_company_members(uuid)', 'execute'),
  'anon cannot execute the helper');

select ok(
  has_function_privilege('authenticated', 'public.can_manage_company_members(uuid)', 'execute'),
  'authenticated can execute the helper');

-- -----------------------------------------------------------------------------
-- 6. Member reads are unchanged by AAL (checked before any write)
-- -----------------------------------------------------------------------------
set local role authenticated;

select set_config('request.jwt.claims',
  '{"sub":"a3000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.company_members), 2,
  'member sees own row + co-member at AAL1');

select set_config('request.jwt.claims',
  '{"sub":"a3000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.company_members), 2,
  'member sees own row + co-member at AAL2 (same as AAL1)');

-- -----------------------------------------------------------------------------
-- 1. AAL1 admin of the active company is denied
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select throws_ok(
  $$ insert into public.company_members (company_id, user_id, role, status, invited_by)
     values ('c1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000005',
             'employee', 'invited', 'a1000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'AAL1 admin cannot invite');
select is_empty(
  $$ update public.company_members set role = 'viewer'
      where user_id = 'a3000000-0000-0000-0000-000000000003' returning id $$,
  'AAL1 admin cannot update a member');
select is_empty(
  $$ delete from public.company_members
      where user_id = 'a3000000-0000-0000-0000-000000000003' returning id $$,
  'AAL1 admin cannot delete a member');

-- -----------------------------------------------------------------------------
-- 2. No aal claim at all: fail closed
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.company_members (company_id, user_id, role, status, invited_by)
     values ('c1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000005',
             'employee', 'invited', 'a1000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'admin with no aal claim cannot invite (fail closed)');
select is_empty(
  $$ update public.company_members set role = 'viewer'
      where user_id = 'a3000000-0000-0000-0000-000000000003' returning id $$,
  'admin with no aal claim cannot update (fail closed)');
select is_empty(
  $$ delete from public.company_members
      where user_id = 'a3000000-0000-0000-0000-000000000003' returning id $$,
  'admin with no aal claim cannot delete (fail closed)');

-- -----------------------------------------------------------------------------
-- 3. AAL2 admin of a suspended company is denied
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ insert into public.company_members (company_id, user_id, role, status, invited_by)
     values ('c2000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000005',
             'employee', 'invited', 'a2000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'suspended-company admin cannot invite at AAL2');
select is_empty(
  $$ update public.company_members set role = 'viewer'
      where user_id = 'a4000000-0000-0000-0000-000000000004' returning id $$,
  'suspended-company admin cannot update at AAL2');
select is_empty(
  $$ delete from public.company_members
      where user_id = 'a4000000-0000-0000-0000-000000000004' returning id $$,
  'suspended-company admin cannot delete at AAL2');

-- -----------------------------------------------------------------------------
-- 5. Plain (non-admin) member at AAL2 is denied
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a3000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ insert into public.company_members (company_id, user_id, role, status, invited_by)
     values ('c1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000005',
             'employee', 'invited', 'a3000000-0000-0000-0000-000000000003') $$,
  '42501', null, 'non-admin member cannot invite at AAL2');
select is_empty(
  $$ update public.company_members set role = 'viewer'
      where user_id = 'a1000000-0000-0000-0000-000000000001' returning id $$,
  'non-admin member cannot update at AAL2');
select is_empty(
  $$ delete from public.company_members
      where user_id = 'a1000000-0000-0000-0000-000000000001' returning id $$,
  'non-admin member cannot delete at AAL2');

-- -----------------------------------------------------------------------------
-- 4. AAL2 admin of the active company is allowed
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ insert into public.company_members (company_id, user_id, role, status, invited_by)
     values ('c1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000005',
             'aal2_test_super', 'invited', 'a1000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'AAL2 admin cannot invite a role ranked above their own');
select throws_ok(
  $$ update public.company_members set role = 'aal2_test_super'
      where user_id = 'a3000000-0000-0000-0000-000000000003' $$,
  '42501', null, 'AAL2 admin cannot assign a role ranked above their own');
select throws_ok(
  $$ insert into public.company_members (company_id, user_id, role, status, invited_by)
     values ('c1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000005',
             'employee', 'active', 'a1000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'AAL2 admin cannot insert an active member');

select isnt_empty(
  $$ insert into public.company_members (company_id, user_id, role, status, invited_by)
     values ('c1000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000005',
             'employee', 'invited', 'a1000000-0000-0000-0000-000000000001') returning id $$,
  'AAL2 admin can invite');
select throws_ok(
  $$ update public.company_members set status = 'active'
      where user_id = 'a5000000-0000-0000-0000-000000000005' $$,
  '42501', null, 'AAL2 admin cannot activate an invited member (trigger)');
select isnt_empty(
  $$ update public.company_members set role = 'viewer'
      where user_id = 'a3000000-0000-0000-0000-000000000003' returning id $$,
  'AAL2 admin can change a member role');
select isnt_empty(
  $$ update public.company_members set status = 'disabled'
      where user_id = 'a3000000-0000-0000-0000-000000000003' returning id $$,
  'AAL2 admin can disable a member');
select isnt_empty(
  $$ delete from public.company_members
      where user_id = 'a5000000-0000-0000-0000-000000000005' returning id $$,
  'AAL2 admin can delete a member');

-- -----------------------------------------------------------------------------
-- 7. service_role is unaffected
-- -----------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;

select isnt_empty(
  $$ insert into public.company_members (company_id, user_id, role, status)
     values ('c1000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000004',
             'employee', 'active') returning id $$,
  'service_role can insert (including active rows)');
select isnt_empty(
  $$ update public.company_members set role = 'employee'
      where user_id = 'a3000000-0000-0000-0000-000000000003' returning id $$,
  'service_role can update');

reset role;

select * from finish();
rollback;
