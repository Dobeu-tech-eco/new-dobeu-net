-- =============================================================================
-- Direct auth user lookup by email (D48).
--
-- findUserIdByEmail paged auth.admin.listUsers (20 x 200 cap), so an existing
-- invitee past ~4,000 users could not be resolved. This SECURITY DEFINER
-- function reads auth.users directly. Only the service role may execute it;
-- it is revoked from public, anon and authenticated (default PUBLIC execute
-- would otherwise expose an email -> user id oracle).
-- =============================================================================

create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
  -- auth.users email is unique in practice; if legacy data ever held two
  -- case-variant rows, pick the oldest deterministically.
  order by u.created_at
  limit 1
$fn$;

revoke all on function public.find_auth_user_id_by_email(text) from public;
revoke all on function public.find_auth_user_id_by_email(text) from anon;
revoke all on function public.find_auth_user_id_by_email(text) from authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
