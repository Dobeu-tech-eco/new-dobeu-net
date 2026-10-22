-- =============================================================================
-- pgTAP: RLS hardening (20261022000100_rls_advisor_hardening.sql)
-- Run: pnpm supabase test db   (requires the local Docker stack)
--
-- Fixtures (all rolled back):
--   user A  owns project PA (company X) + PA2 (personal), invoice IA (on PA)
--           + IA2 (on PA2), work order WA (company X) + WA2 (personal)
--   user B  unrelated signed-in user (non-owner, non-member)
--   user C  active employee of company X (no rows of their own)
--   user D  active company_admin of company X
--   company Y: user A is an active employee (cross-company project check)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

-- -----------------------------------------------------------------------------
-- Fixtures (as the migration owner, bypassing RLS)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'rls-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'rls-b@example.test', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'rls-c@example.test', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'rls-d@example.test', 'authenticated', 'authenticated');

insert into public.companies (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'RLS Test Co'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'RLS Test Co Y');

insert into public.company_members (company_id, user_id, role, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'employee', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'company_admin', 'active'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'employee', 'active');

insert into public.projects (id, owner_user_id, title, company_id) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Project A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Project A2', null);

insert into public.invoices (id, project_id, user_id, amount_cents) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 10000),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 20000);

insert into public.work_orders (id, created_by, service_type, title, company_id) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'logo', 'WO A', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'logo', 'WO A2', null);

-- -----------------------------------------------------------------------------
-- Catalog checks
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'RLS is enabled on every public table'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and cmd = 'UPDATE' and with_check is null),
  0,
  'every public UPDATE policy has a WITH CHECK clause'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname in ('public', 'storage')
      and regexp_replace(
            coalesce(qual, '') || ' ' || coalesce(with_check, ''),
            '\(\s*SELECT auth\.uid\(\) AS uid\)', '', 'g'
          ) ~ 'auth\.uid\(\)'),
  0,
  'no policy calls auth.uid() without the (select ...) initplan wrapper'
);

select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at', 'handle_new_user', 'is_company_member', 'company_role_rank',
        'enforce_typeform_budget_intake_state', 'audit_typeform_budget_intake_review'
      )
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
        where c like 'search_path=%'
      )),
  0,
  'every hardened public function pins search_path'
);

select ok(
  not has_function_privilege('anon', 'public.is_company_member(uuid)', 'execute'),
  'anon cannot execute is_company_member'
);

select ok(
  has_function_privilege('authenticated', 'public.is_company_member(uuid)', 'execute'),
  'authenticated keeps execute on is_company_member (RLS policies need it)'
);

select ok(
  not has_function_privilege('anon', 'public.company_role_rank(uuid)', 'execute'),
  'anon cannot execute company_role_rank'
);

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'page_events'),
  0,
  'page_events has no client policies (anon insert removed)'
);

-- -----------------------------------------------------------------------------
-- As user B (non-owner, non-member)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is_empty($$ select id from public.projects $$,
  'non-owner cannot select another user''s projects');

select is_empty(
  $$ update public.projects set title = 'pwned'
     where id = 'b0000000-0000-0000-0000-000000000001' returning id $$,
  'non-owner cannot update another user''s project');

select is_empty($$ select id from public.invoices $$,
  'non-owner cannot select another user''s invoices');

select is_empty(
  $$ update public.invoices set amount_cents = 1
     where id = 'c0000000-0000-0000-0000-000000000001' returning id $$,
  'non-owner cannot update another user''s invoice');

select is_empty($$ select id from public.work_orders $$,
  'non-owner cannot select another user''s work orders');

select is_empty(
  $$ update public.work_orders set quoted_amount_cents = 1
     where id = 'd0000000-0000-0000-0000-000000000001' returning id $$,
  'non-owner cannot update another user''s work order');

select throws_ok(
  $$ insert into public.work_orders (created_by, service_type, title, company_id)
     values ('22222222-2222-2222-2222-222222222222', 'logo', 'inject',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', null,
  'non-member cannot insert a work order into another company''s scope');

select throws_ok(
  $$ insert into public.work_orders (created_by, service_type, title, status, quoted_amount_cents)
     values ('22222222-2222-2222-2222-222222222222', 'logo', 'self-quote', 'quoted', 1) $$,
  '42501', null,
  'client cannot insert a pre-quoted work order');

-- -----------------------------------------------------------------------------
-- As user C (active member of company X)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select results_eq(
  $$ select id from public.projects order by id $$,
  $$ values ('b0000000-0000-0000-0000-000000000001'::uuid) $$,
  'company member reads company-scoped projects only');

select results_eq(
  $$ select id from public.invoices order by id $$,
  $$ values ('c0000000-0000-0000-0000-000000000001'::uuid) $$,
  'company member reads company-scoped invoices only');

select results_eq(
  $$ select id from public.work_orders order by id $$,
  $$ values ('d0000000-0000-0000-0000-000000000001'::uuid) $$,
  'company member reads company-scoped work orders only');

select is_empty(
  $$ update public.projects set title = 'member-edit'
     where id = 'b0000000-0000-0000-0000-000000000001' returning id $$,
  'company member cannot update a company project (read-only widening)');

-- -----------------------------------------------------------------------------
-- As user D (company_admin of company X)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select throws_ok(
  $$ update public.company_members
        set user_id = '22222222-2222-2222-2222-222222222222'
      where user_id = '33333333-3333-3333-3333-333333333333' $$,
  '42501', null,
  'company admin cannot rewrite a member''s user_id');

-- -----------------------------------------------------------------------------
-- As user A (owner)
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.projects), 2, 'owner reads both own projects');
select is((select count(*)::int from public.invoices), 2, 'owner reads both own invoices');
select is((select count(*)::int from public.work_orders), 2, 'owner reads both own work orders');

select lives_ok(
  $$ insert into public.work_orders (created_by, service_type, title, status)
     values ('11111111-1111-1111-1111-111111111111', 'logo', 'new request', 'open') $$,
  'owner can still submit an open work order (submitWorkOrder path)');

select throws_ok(
  $$ update public.profiles set stripe_customer_id = 'cus_foreign'
      where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'user cannot change their own stripe_customer_id');

select lives_ok(
  $$ update public.profiles set full_name = 'Renamed'
      where id = '11111111-1111-1111-1111-111111111111' $$,
  'user can still update their own full_name (updateProfile path)');

select throws_ok(
  $$ insert into public.work_orders (created_by, service_type, title, status, company_id, project_id)
     values ('11111111-1111-1111-1111-111111111111', 'logo', 'cross-company', 'open',
             'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
             'b0000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'work order cannot pair company Y with a project that belongs to company X');

-- -----------------------------------------------------------------------------
-- Back to the owner role: confirm no write leaked through.
-- -----------------------------------------------------------------------------
reset role;

select is(
  (select title from public.projects where id = 'b0000000-0000-0000-0000-000000000001'),
  'Project A',
  'blocked updates left the project untouched'
);

select * from finish();
rollback;
