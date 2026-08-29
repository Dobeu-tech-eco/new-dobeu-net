-- Durable, review-first intake for the public Typeform budget form.
--
-- This table deliberately contains no pricing or delivery state. The webhook
-- only records the signed submission; an MFA-protected admin reviews it later.

-- Production predates the broader multi-tenant migration that originally
-- introduced this shared audit table. Create only that narrow prerequisite
-- here, using the same schema so the later migration remains compatible.
create table if not exists public.admin_audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  data jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;

create table public.typeform_budget_intakes (
  id uuid primary key default uuid_generate_v4(),

  form_id text not null,
  response_token text not null,
  event_id text,
  submitted_at timestamptz,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  status text not null default 'new',
  mapping_status text not null default 'needs_review',
  mapping_warnings jsonb not null default '[]'::jsonb,

  email text,
  name text,
  company text,
  service_family_ref text,
  service_family_label text,
  budget_band_ref text,
  budget_band_label text,
  project_summary text,

  raw_payload jsonb not null,

  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,

  constraint typeform_budget_intakes_form_id_check
    check (form_id = 'wKVKIBe7'),
  constraint typeform_budget_intakes_response_token_check
    check (char_length(response_token) between 1 and 512),
  constraint typeform_budget_intakes_status_check
    check (status in ('new', 'reviewed', 'archived')),
  constraint typeform_budget_intakes_mapping_status_check
    check (mapping_status in ('mapped', 'needs_review')),
  constraint typeform_budget_intakes_mapping_warnings_check
    check (jsonb_typeof(mapping_warnings) = 'array'),
  constraint typeform_budget_intakes_review_metadata_check
    check (
      (
        status = 'new'
        and reviewed_at is null
        and reviewed_by is null
      )
      or (
        status in ('reviewed', 'archived')
        and reviewed_at is not null
        and reviewed_by is not null
      )
    ),
  constraint typeform_budget_intakes_form_response_unique
    unique (form_id, response_token)
);

create index typeform_budget_intakes_status_received_idx
  on public.typeform_budget_intakes (status, received_at desc);

drop trigger if exists typeform_budget_intakes_updated_at
  on public.typeform_budget_intakes;
create trigger typeform_budget_intakes_updated_at
  before update on public.typeform_budget_intakes
  for each row execute function public.set_updated_at();

-- Enforce the initial state and the complete transition matrix in PostgreSQL,
-- even for privileged service-role callers that bypass RLS.
create or replace function public.enforce_typeform_budget_intake_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'new'
      or new.reviewed_at is not null
      or new.reviewed_by is not null then
      raise exception 'intake must be inserted in new state without review metadata'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'archived' then
      raise exception 'archived intake is immutable'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.status = 'archived' then
    raise exception 'archived intake is immutable'
      using errcode = 'check_violation';
  end if;

  if old.status = 'reviewed' and new.status = 'new' then
    raise exception 'reviewed intake cannot return to new'
      using errcode = 'check_violation';
  end if;

  if new.status = 'new' then
    if new.reviewed_at is not null or new.reviewed_by is not null then
      raise exception 'new intake cannot have review metadata'
        using errcode = 'check_violation';
    end if;
  elsif new.reviewed_at is null or new.reviewed_by is null then
    raise exception 'review actor and timestamp are required'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_typeform_budget_intake_state()
  from public, anon, authenticated;

drop trigger if exists typeform_budget_intakes_state_guard
  on public.typeform_budget_intakes;
create trigger typeform_budget_intakes_state_guard
  before insert or update or delete on public.typeform_budget_intakes
  for each row execute function public.enforce_typeform_budget_intake_state();

-- Keep the privileged state transition and its actor audit in one database
-- transaction. If this insert fails, PostgreSQL rolls back the intake update.
create or replace function public.audit_typeform_budget_intake_review()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status not in ('reviewed', 'archived') then
    return new;
  end if;

  if new.reviewed_by is null or new.reviewed_at is null then
    raise exception 'review actor and timestamp are required'
      using errcode = 'check_violation';
  end if;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    data
  ) values (
    new.reviewed_by,
    case new.status
      when 'reviewed' then 'typeform_budget_intake.review'
      else 'typeform_budget_intake.archive'
    end,
    'typeform_budget_intake',
    new.id::text,
    jsonb_build_object(
      'previous_status', old.status,
      'status', new.status,
      'review_notes', new.review_notes
    )
  );

  return new;
end;
$$;

revoke execute on function public.audit_typeform_budget_intake_review()
  from public, anon, authenticated;

drop trigger if exists typeform_budget_intakes_review_audit
  on public.typeform_budget_intakes;
create trigger typeform_budget_intakes_review_audit
  after update of status, review_notes, reviewed_by, reviewed_at
  on public.typeform_budget_intakes
  for each row
  when (
    old.status is distinct from new.status
    or old.review_notes is distinct from new.review_notes
    or old.reviewed_by is distinct from new.reviewed_by
    or old.reviewed_at is distinct from new.reviewed_at
  )
  execute function public.audit_typeform_budget_intake_review();

alter table public.typeform_budget_intakes enable row level security;

-- The webhook and MFA-protected admin surface use createAdminClient(). Anon
-- and authenticated roles receive no direct table privileges or RLS policies.
revoke all on table public.typeform_budget_intakes from anon, authenticated;

comment on table public.typeform_budget_intakes is
  'Signed Typeform budget submissions awaiting human review. Service-role access only.';
comment on column public.typeform_budget_intakes.response_token is
  'Typeform response token; unique with form_id so webhook retries are idempotent.';
comment on column public.typeform_budget_intakes.raw_payload is
  'Complete signed webhook JSON. Authoritative when bounded extracted columns omit detail.';
