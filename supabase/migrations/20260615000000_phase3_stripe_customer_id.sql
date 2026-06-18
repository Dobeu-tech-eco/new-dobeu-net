-- =============================================================================
-- dobeu.net v3 — Phase 3 mini-migration: profiles.stripe_customer_id
-- -----------------------------------------------------------------------------
-- Per .agent/PRODUCTION-PLAN.md §5 Phase 3, locked Phase 3 decisions
-- (Stripe-hosted invoicing): admin clicks "Create Stripe Invoice" → the
-- Stripe customer is lazy-created on first invoice (search by email first,
-- then create), and the resulting `cus_*` id is persisted on the profile so
-- subsequent invoices reuse it.
--
-- Idempotent: safe to re-run during cutover prep.
-- =============================================================================

alter table public.profiles
  add column if not exists stripe_customer_id text;

-- Partial unique index: lets every profile leave the column NULL until first
-- invoice, but enforces one-to-one once populated. (A plain `unique` constraint
-- would treat NULLs as distinct in Postgres so the partial form is functionally
-- equivalent here, but is explicit about intent.)
create unique index if not exists profiles_stripe_customer_id_unique
  on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.profiles.stripe_customer_id is
  'Stripe customer ID (cus_*); lazy-created on first invoice issued.';
