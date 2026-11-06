-- =============================================================================
-- pgTAP: public.find_auth_user_id_by_email (20261105000200_find_auth_user_id_by_email.sql)
-- Run: pnpm supabase test db   (requires the local Docker stack)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_function('public', 'find_auth_user_id_by_email', array['text'],
  'function exists');

select is(
  (select prosecdef from pg_proc
   where oid = 'public.find_auth_user_id_by_email(text)'::regprocedure),
  true, 'function is SECURITY DEFINER');

select ok(
  exists (
    select 1 from pg_proc p, unnest(coalesce(p.proconfig, '{}')) c
    where p.oid = 'public.find_auth_user_id_by_email(text)'::regprocedure
      and c like 'search_path=%'),
  'search_path is pinned');

select is(has_function_privilege('anon',
  'public.find_auth_user_id_by_email(text)', 'execute'), false,
  'anon cannot execute');
select is(has_function_privilege('authenticated',
  'public.find_auth_user_id_by_email(text)', 'execute'), false,
  'authenticated cannot execute');
select is(has_function_privilege('service_role',
  'public.find_auth_user_id_by_email(text)', 'execute'), true,
  'service_role can execute');
select is(
  (select count(*)::int from information_schema.routine_privileges
   where routine_schema = 'public'
     and routine_name = 'find_auth_user_id_by_email'
     and grantee = 'PUBLIC'),
  0, 'PUBLIC has no execute grant');

insert into auth.users (id, instance_id, aud, role, email)
values ('f0000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'Lookup.Case@Example.test');

select is(
  public.find_auth_user_id_by_email('lookup.case@example.test'),
  'f0000000-0000-0000-0000-0000000000a1'::uuid,
  'matches case-insensitively');

select is(
  public.find_auth_user_id_by_email('nobody-here@example.test'),
  null::uuid, 'returns null for an unknown email');

select * from finish();
rollback;
