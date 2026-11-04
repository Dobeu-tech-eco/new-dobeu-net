-- =============================================================================
-- Unique leads.raw_payload->>'verify_nonce' (2026-11-04)
-- -----------------------------------------------------------------------------
-- A double opt-in confirm token carries a nonce that processLead() stores in
-- leads.raw_payload.verify_nonce. app/api/lead/confirm pre-checks for an
-- existing lead (findLeadByVerifyNonce) and takes a per-nonce lock, but without
-- Upstash both are per-instance, so two instances can each pass the check and
-- insert twice -- and every insert also fires the Apollo, Customer.io and Resend
-- fan-out. This index makes the database the arbiter. processLead() maps the
-- resulting 23505 on leads_verify_nonce_key to LeadAlreadyConfirmedError and
-- returns before any fan-out step.
--
-- Deliberately NOT partial: the PostgREST lookup
-- `raw_payload->>verify_nonce = $1` can only use an index whose predicate it
-- can prove, and a non-partial expression index serves it directly. Leads
-- without a nonce yield NULL, and NULLs never collide, so any number of them
-- stay allowed.
--
-- Never skips silently: if duplicates exist the migration FAILS and reports
-- how many verify_nonce values are duplicated. Dedupe by hand, then re-run.
-- =============================================================================

do $$
declare
  v_dup_nonces bigint;
  v_dup_rows   bigint;
begin
  select count(*), coalesce(sum(n), 0)
    into v_dup_nonces, v_dup_rows
  from (
    select count(*) as n
    from public.leads
    where raw_payload->>'verify_nonce' is not null
    group by raw_payload->>'verify_nonce'
    having count(*) > 1
  ) d;

  if v_dup_nonces > 0 then
    raise exception
      'leads.raw_payload->>verify_nonce has % duplicated value(s) across % rows; dedupe before creating leads_verify_nonce_key',
      v_dup_nonces, v_dup_rows;
  end if;
end $$;

create unique index if not exists leads_verify_nonce_key
  on public.leads ((raw_payload->>'verify_nonce'));
