-- D52: wo_insert_own requires an ACTIVE company for company work orders.
-- Requires 20261105000300_wo_insert_active_company.sql.
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email, aud, role) values
  ('d5200000-0000-4000-8000-000000000001', 'd52-ma@example.test', 'authenticated', 'authenticated'),
  ('d5200000-0000-4000-8000-000000000002', 'd52-ms@example.test', 'authenticated', 'authenticated');

insert into public.companies (id, name, status) values
  ('d5200000-0000-4000-8000-0000000000a1', 'D52 Active Co', 'active'),
  ('d5200000-0000-4000-8000-0000000000a2', 'D52 Suspended Co', 'suspended');

insert into public.company_members (company_id, user_id, role, status) values
  ('d5200000-0000-4000-8000-0000000000a1', 'd5200000-0000-4000-8000-000000000001', 'employee', 'active'),
  ('d5200000-0000-4000-8000-0000000000a2', 'd5200000-0000-4000-8000-000000000002', 'employee', 'active');

set local role authenticated;

-- active member, active company: allowed
select set_config('request.jwt.claims', '{"sub":"d5200000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.work_orders (created_by, service_type, title, company_id)
     values ('d5200000-0000-4000-8000-000000000001', 'logo', 'D52 active', 'd5200000-0000-4000-8000-0000000000a1') $$,
  'active-company member can insert a company work order');
select throws_ok(
  $$ insert into public.work_orders (created_by, service_type, title, company_id)
     values ('d5200000-0000-4000-8000-000000000001', 'logo', 'D52 foreign', 'd5200000-0000-4000-8000-0000000000a2') $$,
  '42501', null, 'non-member cannot insert for another company');

-- suspended member: company denied, personal allowed
select set_config('request.jwt.claims', '{"sub":"d5200000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.work_orders (created_by, service_type, title, company_id)
     values ('d5200000-0000-4000-8000-000000000002', 'logo', 'D52 suspended', 'd5200000-0000-4000-8000-0000000000a2') $$,
  '42501', null, 'suspended-company member cannot insert a company work order');
select lives_ok(
  $$ insert into public.work_orders (created_by, service_type, title)
     values ('d5200000-0000-4000-8000-000000000002', 'logo', 'D52 personal') $$,
  'suspended-company member can still insert a personal work order');

reset role;

select set_eq(
  $$ select policyname::text collate "default", cmd::text collate "default", permissive::text collate "default"
       from pg_policies
      where schemaname = 'public' and tablename = 'work_orders' $$,
  $$ values
       ('wo_insert_own'::text collate "default", 'INSERT'::text collate "default", 'PERMISSIVE'::text collate "default"),
       ('wo_select_owner_or_company'::text collate "default", 'SELECT'::text collate "default", 'PERMISSIVE'::text collate "default") $$,
  'work_orders has exactly the insert + select policies');

select lives_ok($$ select private.assert_wo_insert_policy_set() $$, 'guard passes on the pinned set');

create policy "d52_stray_insert" on public.work_orders for insert to authenticated with check (true);
select throws_ok($$ select private.assert_wo_insert_policy_set() $$, null, null,
  'guard raises when a stray permissive INSERT policy exists');
drop policy "d52_stray_insert" on public.work_orders;

select lives_ok($$ select private.assert_wo_insert_policy_set() $$, 'guard passes again after the stray policy is dropped');

select * from finish();
rollback;
