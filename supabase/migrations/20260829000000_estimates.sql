-- Preliminary project estimates produced by the Typeform scope intake.
--
-- One row per submitted intake. Stores BOTH the normalized inputs and the
-- computed output so an estimate can be re-derived and audited later against
-- the `rate_card_version` it was produced under -- rate-card edits must never
-- silently rewrite a number already sent to a client.
--
-- Access model mirrors the rest of the app: RLS on, no anon or authenticated
-- policies, all reads and writes go through `createAdminClient()` (service
-- role) from the webhook and the admin surface. The public estimate page is
-- addressed by an unguessable `token` and served by the same service-role
-- client, so no client-side policy is required.

create table public.estimates (
  id uuid primary key default uuid_generate_v4(),

  -- Unguessable public handle for /estimate/<token>. 32 hex chars.
  token text not null unique,

  -- Soft link: an estimate is still worth keeping if the lead insert failed.
  lead_id uuid references public.leads(id) on delete set null,

  -- Typeform provenance. `response_id` is the dedupe key for webhook retries.
  form_id text,
  response_id text unique,

  -- Contact snapshot, denormalized so the estimate reads standalone.
  email text not null,
  name text,
  company text,

  -- Model provenance and headline figures (whole US dollars).
  rate_card_version text not null,
  track text not null,
  amount_low integer not null,
  amount_mid integer not null,
  amount_high integer not null,
  total_hours numeric(8, 1) not null default 0,
  confidence text not null,
  budget_fit text not null,

  -- Full computed breakdown (line items, uplifts, multipliers, flags) and the
  -- normalized inputs it was derived from.
  breakdown jsonb not null default '{}'::jsonb,
  inputs jsonb not null default '{}'::jsonb,

  -- Free-text the client wrote. Read before replying.
  narrative jsonb not null default '{}'::jsonb,

  -- Set once the client-facing email is dispatched.
  emailed_at timestamptz,

  created_at timestamptz not null default now()
);

create index estimates_email_idx on public.estimates (email);
create index estimates_created_at_idx on public.estimates (created_at desc);
create index estimates_lead_id_idx on public.estimates (lead_id);

alter table public.estimates enable row level security;

-- No anon/authenticated policies by design. Service role bypasses RLS; every
-- other role sees nothing. Adding a policy here would expose pricing internals.

comment on table public.estimates is
  'Preliminary planning estimates from the Typeform scope intake. Service-role access only.';
comment on column public.estimates.token is
  'Unguessable public handle used by /estimate/<token>. Not a secret in the cryptographic sense; treat as a capability URL.';
comment on column public.estimates.rate_card_version is
  'lib/pricing/rate-card.ts RATE_CARD_VERSION at compute time. Never backfill.';
comment on column public.estimates.response_id is
  'Typeform response token. Unique so webhook retries upsert instead of duplicating.';
