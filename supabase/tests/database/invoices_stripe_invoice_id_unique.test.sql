-- =============================================================================
-- pgTAP: unique invoices.stripe_invoice_id when set
-- (20261105000500_invoices_stripe_invoice_id_unique.sql)
-- Run: pnpm supabase test db   (requires the local Docker stack)
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email, aud, role) values
  ('55555555-5555-5555-5555-555555555555', 'inv-uniq@example.test', 'authenticated', 'authenticated');

select has_index(
  'public', 'invoices', 'invoices_stripe_invoice_id_key',
  'invoices_stripe_invoice_id_key exists');

select is(
  (select indisunique and indpred is not null from pg_index
   where indexrelid = 'public.invoices_stripe_invoice_id_key'::regclass),
  true,
  'invoices_stripe_invoice_id_key is unique and partial');

select lives_ok(
  $$ insert into public.invoices (user_id, amount_cents) values
       ('55555555-5555-5555-5555-555555555555', 1000),
       ('55555555-5555-5555-5555-555555555555', 1000) $$,
  'unsent invoices (null stripe_invoice_id) can repeat');

select lives_ok(
  $$ insert into public.invoices (user_id, amount_cents, stripe_invoice_id)
     values ('55555555-5555-5555-5555-555555555555', 2000, 'in_uniq_a') $$,
  'first invoice with a stripe id inserts');

select throws_ok(
  $$ insert into public.invoices (user_id, amount_cents, stripe_invoice_id)
     values ('55555555-5555-5555-5555-555555555555', 3000, 'in_uniq_a') $$,
  '23505', null,
  'a second invoice with the same stripe id raises unique_violation');

select lives_ok(
  $$ insert into public.invoices (user_id, amount_cents, stripe_invoice_id)
     values ('55555555-5555-5555-5555-555555555555', 3000, 'in_uniq_b') $$,
  'a different stripe id inserts');

select lives_ok(
  $$ update public.invoices set status = 'void'
     where stripe_invoice_id is null
       and user_id = '55555555-5555-5555-5555-555555555555' $$,
  'voiding unsent rows is unaffected by the index');

select * from finish();
rollback;
