-- =============================================================================
-- pgTAP: accepting / declining a company invite is service-role only (D47)
-- Run: pnpm supabase test db   (requires the local Docker stack)
--
-- The invite accept/decline server actions (lib/actions/invites.ts) write with
-- the service role. These tests pin why: an `authenticated` invitee cannot
-- activate or delete their own invited row, because the company_members write
-- policies require an AAL2 admin of the company (and the activation trigger
-- blocks client activation outright). Behaviour asserted is what holds today.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email, aud, role) values
  ('d1000000-0000-0000-0000-000000000001', 'accept-i@example.test', 'authenticated', 'authenticated'),
  ('d2000000-0000-0000-0000-000000000002', 'accept-j@example.test', 'authenticated', 'authenticated');

insert into auth.users (id, email, aud, role) values
  ('d6000000-0000-0000-0000-000000000006', 'accept-admin@example.test', 'authenticated', 'authenticated');

insert into public.companies (id, name, status) values
  ('d3000000-0000-0000-0000-000000000003', 'Accept Co', 'active');

insert into public.company_members (id, company_id, user_id, role, status) values
  ('d4000000-0000-0000-0000-000000000004', 'd3000000-0000-0000-0000-000000000003',
   'd1000000-0000-0000-0000-000000000001', 'employee', 'invited'),
  ('d5000000-0000-0000-0000-000000000005', 'd3000000-0000-0000-0000-000000000003',
   'd2000000-0000-0000-0000-000000000002', 'employee', 'invited'),
  ('d7000000-0000-0000-0000-000000000007', 'd3000000-0000-0000-0000-000000000003',
   'd6000000-0000-0000-0000-000000000006', 'company_admin', 'active');

-- -----------------------------------------------------------------------------
-- 1. authenticated invitee (own row), at AAL2 and at AAL1
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

select is_empty(
  $$ update public.company_members set status = 'active'
      where id = 'd4000000-0000-0000-0000-000000000004' returning id $$,
  'invitee at AAL2 cannot activate their own invited row (no matching update policy)');
select is_empty(
  $$ delete from public.company_members
      where id = 'd4000000-0000-0000-0000-000000000004' returning id $$,
  'invitee at AAL2 cannot delete their own invited row');

select set_config('request.jwt.claims',
  '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);

select is_empty(
  $$ update public.company_members set status = 'active'
      where id = 'd4000000-0000-0000-0000-000000000004' returning id $$,
  'invitee at AAL1 cannot activate their own invited row');
select is_empty(
  $$ update public.company_members set status = 'active'
      where id = 'd5000000-0000-0000-0000-000000000005' returning id $$,
  'invitee cannot activate another user''s invited row');

-- -----------------------------------------------------------------------------
-- 1b. the activation trigger itself: an AAL2 admin of the active company passes
--     RLS on the invited row, so enforce_company_member_activation fires (42501).
--     anon has no table privilege / policy, so it never reaches the trigger.
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"d6000000-0000-0000-0000-000000000006","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$ update public.company_members set status = 'active'
      where id = 'd4000000-0000-0000-0000-000000000004' $$,
  '42501', null, 'AAL2 company admin cannot activate an invited row (trigger)');

reset role;
select is(
  (select status::text collate "default" from public.company_members
    where id = 'd4000000-0000-0000-0000-000000000004'),
  'invited'::text collate "default",
  'the row is still invited after the trigger refusal');

set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ update public.company_members set status = 'active'
      where id = 'd4000000-0000-0000-0000-000000000004' $$,
  '42501', null, 'anon cannot activate an invited row');

reset role;
select is(
  (select status::text collate "default" from public.company_members
    where id = 'd4000000-0000-0000-0000-000000000004'),
  'invited'::text collate "default",
  'the row is still invited after the anon attempt');

-- -----------------------------------------------------------------------------
-- 2. the rows are untouched
-- -----------------------------------------------------------------------------
reset role;
select is(
  (select count(*)::int from public.company_members
    where company_id = 'd3000000-0000-0000-0000-000000000003' and status = 'invited'),
  2, 'both rows are still invited after the denied client writes');

-- -----------------------------------------------------------------------------
-- 3. service_role (what the actions use): conditional accept and decline
-- -----------------------------------------------------------------------------
set local role service_role;

select isnt_empty(
  $$ update public.company_members set status = 'active'
      where id = 'd4000000-0000-0000-0000-000000000004'
        and user_id = 'd1000000-0000-0000-0000-000000000001'
        and status = 'invited' returning id $$,
  'service_role can accept the invitee''s own invited row');
select is_empty(
  $$ update public.company_members set status = 'active'
      where id = 'd4000000-0000-0000-0000-000000000004'
        and user_id = 'd1000000-0000-0000-0000-000000000001'
        and status = 'invited' returning id $$,
  'a repeated accept matches zero rows (status is no longer invited)');
select isnt_empty(
  $$ delete from public.company_members
      where id = 'd5000000-0000-0000-0000-000000000005'
        and user_id = 'd2000000-0000-0000-0000-000000000002'
        and status = 'invited' returning id $$,
  'service_role can decline (delete) the invitee''s own invited row');
select is_empty(
  $$ delete from public.company_members
      where id = 'd4000000-0000-0000-0000-000000000004'
        and user_id = 'd1000000-0000-0000-0000-000000000001'
        and status = 'invited' returning id $$,
  'a decline cannot delete an already-active row');

reset role;
select * from finish();
rollback;
