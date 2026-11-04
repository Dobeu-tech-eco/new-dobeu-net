-- =============================================================================
-- pgTAP: leads verify_nonce uniqueness (20261104000100_leads_verify_nonce_unique.sql)
-- Run: pnpm supabase test db   (requires the local Docker stack)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select has_index(
  'public', 'leads', 'leads_verify_nonce_key',
  'leads_verify_nonce_key exists');

select is(
  (select indisunique from pg_index
   where indexrelid = 'public.leads_verify_nonce_key'::regclass),
  true,
  'leads_verify_nonce_key is unique');

select lives_ok(
  $$ insert into public.leads (email, raw_payload) values
       ('nonce-null-1@example.test', '{}'::jsonb),
       ('nonce-null-2@example.test', '{"message":"hi"}'::jsonb) $$,
  'two leads without a nonce both insert');

select lives_ok(
  $$ insert into public.leads (email, raw_payload)
     values ('nonce-a@example.test', '{"verify_nonce":"nonce-aaaa"}'::jsonb) $$,
  'first lead with a nonce inserts');

select throws_ok(
  $$ insert into public.leads (email, raw_payload)
     values ('nonce-a2@example.test', '{"verify_nonce":"nonce-aaaa"}'::jsonb) $$,
  '23505', null,
  'second lead with the same nonce raises unique_violation');

select lives_ok(
  $$ insert into public.leads (email, raw_payload)
     values ('nonce-b@example.test', '{"verify_nonce":"nonce-bbbb"}'::jsonb) $$,
  'a lead with a different nonce inserts');

select * from finish();
rollback;
