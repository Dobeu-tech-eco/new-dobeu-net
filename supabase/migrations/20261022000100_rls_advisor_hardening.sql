-- =============================================================================
-- dobeu.net v3 — RLS + database-advisor hardening (2026-10-22)
-- -----------------------------------------------------------------------------
-- Audit: docs/security/rls-audit-2026-10.md (static audit of every migration in
-- supabase/migrations/; Supabase MCP / live advisors were not available, so
-- this file is written defensively against schema drift).
--
-- What this migration does:
--   1. Pins search_path on every public function the advisor flags
--      (function_search_path_mutable). Uses ALTER FUNCTION so bodies, owners
--      and grants are left untouched.
--   2. Revokes EXECUTE on SECURITY DEFINER / trigger helpers from PUBLIC and
--      anon. `authenticated` KEEPS execute on is_company_member and
--      company_role_rank because RLS policies call them as the querying role;
--      revoking it would break every company-scoped portal read.
--   3. Re-creates every client-facing policy with the caller's id wrapped as
--      `(select auth.uid())` (auth_rls_initplan) and an explicit
--      `to authenticated` role (no policy evaluates for anon any more).
--   4. Consolidates duplicate permissive SELECT policies (owner + company) on
--      projects, project_files, invoices, work_orders and
--      work_order_attachments into one policy per table
--      (multiple_permissive_policies). Semantics are unchanged: owner OR
--      active company member.
--   5. Tightens client INSERT policies on work_orders and
--      work_order_attachments so a client cannot inject rows into another
--      tenant's company view, pre-set quote/invoice state, or write
--      attachment rows outside the work order's storage namespace.
--   6. Drops the remaining anonymous INSERT policy (page_events) and revokes
--      direct anon/authenticated table privileges on the service-role-only
--      tables (leads, bookings, page_events).
--   7. Adds covering indexes for unindexed foreign keys
--      (unindexed_foreign_keys).
--
-- Not touched here: storage.buckets (owned by a separate change), existing
-- migration files, and any table/column definitions.
--
-- Idempotent: every policy is `drop policy if exists` + `create policy` by
-- name, every index is `if not exists`, and every block is guarded on the
-- target table / function / column existing. Safe to re-run.
-- =============================================================================


-- =============================================================================
-- 1. Functions: pin search_path.
--    Every function gets `pg_catalog, public`: pg_catalog first so built-ins
--    cannot be shadowed, and pg_temp deliberately NOT listed (Postgres
--    guidance for SECURITY DEFINER; the bodies reference only public.* and
--    auth.uid(), never temp objects). An empty path was rejected because the
--    live schema has not been diffed (S2) and a drifted body with
--    unqualified names would break signups.
-- =============================================================================
do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    alter function public.set_updated_at() set search_path = pg_catalog, public;
  end if;

  if to_regprocedure('public.handle_new_user()') is not null then
    alter function public.handle_new_user() set search_path = pg_catalog, public;
  end if;

  if to_regprocedure('public.is_company_member(uuid)') is not null then
    alter function public.is_company_member(uuid) set search_path = pg_catalog, public;
  end if;

  if to_regprocedure('public.company_role_rank(uuid)') is not null then
    alter function public.company_role_rank(uuid) set search_path = pg_catalog, public;
  end if;

  if to_regprocedure('public.enforce_typeform_budget_intake_state()') is not null then
    alter function public.enforce_typeform_budget_intake_state() set search_path = pg_catalog, public;
  end if;

  if to_regprocedure('public.audit_typeform_budget_intake_review()') is not null then
    alter function public.audit_typeform_budget_intake_review() set search_path = pg_catalog, public;
  end if;
end $$;


-- =============================================================================
-- 2. Function EXECUTE grants.
--    - Trigger functions are never invoked by API roles (EXECUTE is checked
--      when a trigger is created, not when it fires), so revoke from
--      public/anon/authenticated.
--    - Membership helpers: revoke from public + anon (no anon policy calls
--      them after section 3), keep authenticated + service_role.
-- =============================================================================
do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    revoke execute on function public.set_updated_at() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.handle_new_user()') is not null then
    revoke execute on function public.handle_new_user() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.is_company_member(uuid)') is not null then
    revoke execute on function public.is_company_member(uuid) from public, anon;
    grant execute on function public.is_company_member(uuid) to authenticated, service_role;
  end if;

  if to_regprocedure('public.company_role_rank(uuid)') is not null then
    revoke execute on function public.company_role_rank(uuid) from public, anon;
    grant execute on function public.company_role_rank(uuid) to authenticated, service_role;
  end if;

  -- Defensive re-revoke: a database that skipped 20260829010000 would keep
  -- the default PUBLIC execute on these trigger functions.
  if to_regprocedure('public.enforce_typeform_budget_intake_state()') is not null then
    revoke execute on function public.enforce_typeform_budget_intake_state() from public, anon, authenticated;
  end if;

  if to_regprocedure('public.audit_typeform_budget_intake_review()') is not null then
    revoke execute on function public.audit_typeform_budget_intake_review() from public, anon, authenticated;
  end if;
end $$;


-- =============================================================================
-- 3. Legacy policy cleanup (live-drift safety).
--    These were dropped in 20260605000000 / 20260717064702 but are re-dropped
--    here in case a drifted database still carries them.
-- =============================================================================
do $$
begin
  if to_regclass('public.profiles') is not null then
    drop policy if exists "profiles_admin_all" on public.profiles;
  end if;
  if to_regclass('public.projects') is not null then
    drop policy if exists "projects_admin_all" on public.projects;
  end if;
  if to_regclass('public.project_files') is not null then
    drop policy if exists "project_files_admin_all" on public.project_files;
  end if;
  if to_regclass('public.invoices') is not null then
    drop policy if exists "invoices_admin_all" on public.invoices;
  end if;
  if to_regclass('public.leads') is not null then
    drop policy if exists "leads_admin_select" on public.leads;
    drop policy if exists "leads_admin_update" on public.leads;
    drop policy if exists "leads_insert_anon" on public.leads;
  end if;
  if to_regclass('public.bookings') is not null then
    drop policy if exists "bookings_admin_all" on public.bookings;
    drop policy if exists "bookings_insert_anon" on public.bookings;
  end if;
  if to_regclass('public.page_events') is not null then
    drop policy if exists "page_events_admin_select" on public.page_events;
  end if;
  if to_regclass('public.work_orders') is not null then
    drop policy if exists "wo_update_accept_quote" on public.work_orders;
  end if;
end $$;


-- =============================================================================
-- 4. profiles — own-row read + own-row update of NON-sensitive columns only.
--    No client INSERT (the handle_new_user trigger creates the row) and no
--    client DELETE (auth.users cascade). Table-level write privileges are
--    revoked from the API roles; `authenticated` gets UPDATE only on the
--    columns updateProfile (lib/actions/profile.ts) writes, so a client can
--    never set stripe_customer_id / apollo_contact_id (getOrCreateStripeCustomer
--    trusts the cached Stripe id). service_role is unaffected.
-- =============================================================================
do $$
declare
  v_cols text;
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;

    drop policy if exists "profiles_select_own" on public.profiles;
    create policy "profiles_select_own" on public.profiles
      for select
      to authenticated
      using ((select auth.uid()) = id);

    drop policy if exists "profiles_update_own" on public.profiles;
    create policy "profiles_update_own" on public.profiles
      for update
      to authenticated
      using ((select auth.uid()) = id)
      with check ((select auth.uid()) = id);

    revoke insert, update, delete on table public.profiles from anon, authenticated;

    select string_agg(quote_ident(attname), ', ' order by attname)
      into v_cols
      from pg_attribute
      where attrelid = to_regclass('public.profiles')
        and attname in ('full_name', 'company', 'phone', 'notify_email')
        and not attisdropped;

    if v_cols is not null then
      execute format('grant update (%s) on table public.profiles to authenticated', v_cols);
    end if;
  end if;
end $$;


-- =============================================================================
-- 5. projects — one SELECT policy: owner OR active company member.
--    Writes stay service-role only (admin CRUD in lib/actions/projects.ts).
-- =============================================================================
do $$
declare
  v_company boolean :=
    to_regprocedure('public.is_company_member(uuid)') is not null
    and exists (
      select 1 from pg_attribute
      where attrelid = to_regclass('public.projects')
        and attname = 'company_id' and not attisdropped
    );
begin
  if to_regclass('public.projects') is not null then
    alter table public.projects enable row level security;

    drop policy if exists "projects_select_own" on public.projects;
    drop policy if exists "projects_select_company" on public.projects;
    drop policy if exists "projects_select_owner_or_company" on public.projects;

    if v_company then
      create policy "projects_select_owner_or_company" on public.projects
        for select
        to authenticated
        using (
          owner_user_id = (select auth.uid())
          or (company_id is not null and public.is_company_member(company_id))
        );
    else
      create policy "projects_select_owner_or_company" on public.projects
        for select
        to authenticated
        using (owner_user_id = (select auth.uid()));
    end if;
  end if;
end $$;


-- =============================================================================
-- 6. project_files — one SELECT policy, inherited from the parent project.
--    Uploads/deletes stay service-role only (lib/actions/files.ts).
-- =============================================================================
do $$
declare
  v_company boolean :=
    to_regprocedure('public.is_company_member(uuid)') is not null
    and exists (
      select 1 from pg_attribute
      where attrelid = to_regclass('public.projects')
        and attname = 'company_id' and not attisdropped
    );
begin
  if to_regclass('public.project_files') is not null
     and to_regclass('public.projects') is not null then
    alter table public.project_files enable row level security;

    drop policy if exists "project_files_select_own" on public.project_files;
    drop policy if exists "project_files_select_company" on public.project_files;
    drop policy if exists "project_files_select_owner_or_company" on public.project_files;

    if v_company then
      create policy "project_files_select_owner_or_company" on public.project_files
        for select
        to authenticated
        using (
          exists (
            select 1 from public.projects p
            where p.id = project_files.project_id
              and (
                p.owner_user_id = (select auth.uid())
                or (p.company_id is not null and public.is_company_member(p.company_id))
              )
          )
        );
    else
      create policy "project_files_select_owner_or_company" on public.project_files
        for select
        to authenticated
        using (
          exists (
            select 1 from public.projects p
            where p.id = project_files.project_id
              and p.owner_user_id = (select auth.uid())
          )
        );
    end if;
  end if;
end $$;


-- =============================================================================
-- 7. invoices — one SELECT policy: direct owner (user_id), project owner, or
--    active member of the project's company. All writes stay service-role
--    (Stripe webhook + admin actions).
-- =============================================================================
do $$
declare
  v_company boolean :=
    to_regprocedure('public.is_company_member(uuid)') is not null
    and exists (
      select 1 from pg_attribute
      where attrelid = to_regclass('public.projects')
        and attname = 'company_id' and not attisdropped
    );
  v_user_col boolean := exists (
    select 1 from pg_attribute
    where attrelid = to_regclass('public.invoices')
      and attname = 'user_id' and not attisdropped
  );
begin
  if to_regclass('public.invoices') is not null
     and to_regclass('public.projects') is not null then
    alter table public.invoices enable row level security;

    drop policy if exists "invoices_select_own" on public.invoices;
    drop policy if exists "invoices_select_company" on public.invoices;
    drop policy if exists "invoices_select_owner_or_company" on public.invoices;

    if v_company and v_user_col then
      create policy "invoices_select_owner_or_company" on public.invoices
        for select
        to authenticated
        using (
          user_id = (select auth.uid())
          or exists (
            select 1 from public.projects p
            where p.id = invoices.project_id
              and (
                p.owner_user_id = (select auth.uid())
                or (p.company_id is not null and public.is_company_member(p.company_id))
              )
          )
        );
    elsif v_user_col then
      create policy "invoices_select_owner_or_company" on public.invoices
        for select
        to authenticated
        using (
          user_id = (select auth.uid())
          or exists (
            select 1 from public.projects p
            where p.id = invoices.project_id
              and p.owner_user_id = (select auth.uid())
          )
        );
    else
      create policy "invoices_select_owner_or_company" on public.invoices
        for select
        to authenticated
        using (
          exists (
            select 1 from public.projects p
            where p.id = invoices.project_id
              and p.owner_user_id = (select auth.uid())
          )
        );
    end if;
  end if;
end $$;


-- =============================================================================
-- 8. leads / bookings / page_events — service-role only.
--    Every write path uses createAdminClient(): leads via lib/leads.ts
--    (processLead), bookings via app/api/webhooks/calendly/route.ts.
--    page_events has no app writer at all (grep for "page_events" in app/,
--    lib/, components/, hooks/ returns nothing), so its
--    `with check (true)` anon INSERT policy was an unauthenticated,
--    un-rate-limited write path with zero legitimate users. Drop it and
--    revoke direct API-role privileges so these tables are not reachable
--    through PostgREST/GraphQL at all. service_role is unaffected.
-- =============================================================================
do $$
begin
  if to_regclass('public.leads') is not null then
    alter table public.leads enable row level security;
    revoke all on table public.leads from anon, authenticated;
  end if;

  if to_regclass('public.bookings') is not null then
    alter table public.bookings enable row level security;
    revoke all on table public.bookings from anon, authenticated;
  end if;

  if to_regclass('public.page_events') is not null then
    alter table public.page_events enable row level security;
    drop policy if exists "page_events_insert_anon" on public.page_events;
    revoke all on table public.page_events from anon, authenticated;
  end if;
end $$;


-- =============================================================================
-- 9. work_orders
--    SELECT: one policy, creator OR active company member.
--    INSERT: creator only, and a client-created row must start in the
--            pristine 'open' state with no quote, acceptance, invoice link or
--            milestone timestamps. company_id (if set) must be a company the
--            caller is an active member of; project_id (if set) must be a
--            project the caller owns, and when company_id is also set the
--            project's company_id must equal it. submitWorkOrder (lib/actions/work-orders.ts)
--            only sets created_by/service_type/title/description/status='open',
--            so it is unaffected. Quote/accept/status transitions run through
--            the service-role client.
--    No client UPDATE/DELETE policy (removed in 20260717064702).
-- =============================================================================
do $$
declare
  v_company boolean :=
    to_regprocedure('public.is_company_member(uuid)') is not null
    and exists (
      select 1 from pg_attribute
      where attrelid = to_regclass('public.work_orders')
        and attname = 'company_id' and not attisdropped
    );
  v_milestones boolean := exists (
    select 1 from pg_attribute
    where attrelid = to_regclass('public.work_orders')
      and attname = 'cancelled_at' and not attisdropped
  );
begin
  if to_regclass('public.work_orders') is not null then
    alter table public.work_orders enable row level security;

    drop policy if exists "wo_select_own" on public.work_orders;
    drop policy if exists "wo_select_company" on public.work_orders;
    drop policy if exists "wo_select_owner_or_company" on public.work_orders;
    drop policy if exists "wo_insert_own" on public.work_orders;

    if v_company then
      create policy "wo_select_owner_or_company" on public.work_orders
        for select
        to authenticated
        using (
          created_by = (select auth.uid())
          or (company_id is not null and public.is_company_member(company_id))
        );
    else
      create policy "wo_select_owner_or_company" on public.work_orders
        for select
        to authenticated
        using (created_by = (select auth.uid()));
    end if;

    if v_company and v_milestones then
      create policy "wo_insert_own" on public.work_orders
        for insert
        to authenticated
        with check (
          created_by = (select auth.uid())
          and status = 'open'
          and quoted_amount_cents is null
          and quoted_at is null
          and accepted_at is null
          and invoice_id is null
          and in_progress_at is null
          and delivered_at is null
          and closed_at is null
          and cancelled_at is null
          and (company_id is null or public.is_company_member(company_id))
          and (
            project_id is null
            or exists (
              select 1 from public.projects p
              where p.id = work_orders.project_id
                and p.owner_user_id = (select auth.uid())
                and (
                  work_orders.company_id is null
                  or p.company_id = work_orders.company_id
                )
            )
          )
        );
    else
      create policy "wo_insert_own" on public.work_orders
        for insert
        to authenticated
        with check (
          created_by = (select auth.uid())
          and status = 'open'
          and quoted_amount_cents is null
          and quoted_at is null
          and accepted_at is null
          and invoice_id is null
          and (
            project_id is null
            or exists (
              select 1 from public.projects p
              where p.id = work_orders.project_id
                and p.owner_user_id = (select auth.uid())
            )
          )
        );
    end if;
  end if;
end $$;


-- =============================================================================
-- 10. work_order_attachments
--     SELECT: one policy inherited from the parent work order.
--     INSERT: creator of the parent work order only, and storage_path must sit
--             under `<work_order_id>/` (finalizeWorkOrderAttachment already
--             enforces this in code; RLS now backs it up).
-- =============================================================================
do $$
declare
  v_company boolean :=
    to_regprocedure('public.is_company_member(uuid)') is not null
    and exists (
      select 1 from pg_attribute
      where attrelid = to_regclass('public.work_orders')
        and attname = 'company_id' and not attisdropped
    );
begin
  if to_regclass('public.work_order_attachments') is not null
     and to_regclass('public.work_orders') is not null then
    alter table public.work_order_attachments enable row level security;

    drop policy if exists "wo_att_select_own" on public.work_order_attachments;
    drop policy if exists "wo_attachments_select_company" on public.work_order_attachments;
    drop policy if exists "wo_att_select_owner_or_company" on public.work_order_attachments;
    drop policy if exists "wo_att_insert_own" on public.work_order_attachments;

    if v_company then
      create policy "wo_att_select_owner_or_company" on public.work_order_attachments
        for select
        to authenticated
        using (
          exists (
            select 1 from public.work_orders w
            where w.id = work_order_attachments.work_order_id
              and (
                w.created_by = (select auth.uid())
                or (w.company_id is not null and public.is_company_member(w.company_id))
              )
          )
        );
    else
      create policy "wo_att_select_owner_or_company" on public.work_order_attachments
        for select
        to authenticated
        using (
          exists (
            select 1 from public.work_orders w
            where w.id = work_order_attachments.work_order_id
              and w.created_by = (select auth.uid())
          )
        );
    end if;

    create policy "wo_att_insert_own" on public.work_order_attachments
      for insert
      to authenticated
      with check (
        storage_path like work_order_id::text || '/%'
        and exists (
          select 1 from public.work_orders w
          where w.id = work_order_attachments.work_order_id
            and w.created_by = (select auth.uid())
        )
      );
  end if;
end $$;


-- =============================================================================
-- 11. Multi-tenant tables (companies, company_roles, company_members,
--     digital_assets, asset_entitlements). Same semantics as
--     20260717120000_multi_tenant_companies.sql; re-created with the wrapped
--     caller id and `to authenticated`.
-- =============================================================================
do $$
begin
  if to_regclass('public.companies') is not null
     and to_regprocedure('public.is_company_member(uuid)') is not null then
    alter table public.companies enable row level security;
    drop policy if exists "companies_select_member" on public.companies;
    create policy "companies_select_member" on public.companies
      for select
      to authenticated
      using (public.is_company_member(id));
  end if;

  if to_regclass('public.company_roles') is not null then
    alter table public.company_roles enable row level security;
    drop policy if exists "company_roles_select_authed" on public.company_roles;
    create policy "company_roles_select_authed" on public.company_roles
      for select
      to authenticated
      using ((select auth.uid()) is not null);
  end if;

  if to_regclass('public.company_members') is not null
     and to_regprocedure('public.is_company_member(uuid)') is not null
     and to_regprocedure('public.company_role_rank(uuid)') is not null then
    alter table public.company_members enable row level security;

    drop policy if exists "company_members_select_comember" on public.company_members;
    create policy "company_members_select_comember" on public.company_members
      for select
      to authenticated
      using (
        user_id = (select auth.uid())
        or public.is_company_member(company_id)
      );

    -- Column-level privileges: a client may INSERT only the invite columns
    -- and UPDATE only role/status, so user_id and company_id can never be
    -- rewritten. inviteMember inserts through the cookie-bound client
    -- (lib/actions/members.ts), so the insert policy must stay; it is
    -- constrained to the 'invited' state attributed to the caller. Both insert
    -- and update also cap the assigned role's rank at the caller's own rank, so
    -- a role added later with rank > 100 cannot be self-assigned. Rows that
    -- start 'active' (companies.ts) are written with the service role.
    revoke insert, update on table public.company_members from anon, authenticated;
    grant insert (company_id, user_id, role, status, invited_by)
      on table public.company_members to authenticated;
    grant update (role, status) on table public.company_members to authenticated;

    drop policy if exists "company_members_admin_insert" on public.company_members;
    create policy "company_members_admin_insert" on public.company_members
      for insert
      to authenticated
      with check (
        public.company_role_rank(company_id) >= 100
        and status = 'invited'
        and invited_by = (select auth.uid())
        and coalesce(
          (select r.rank from public.company_roles r where r.key = company_members.role), 0
        ) <= public.company_role_rank(company_id)
      );

    drop policy if exists "company_members_admin_update" on public.company_members;
    create policy "company_members_admin_update" on public.company_members
      for update
      to authenticated
      using (public.company_role_rank(company_id) >= 100)
      with check (
        public.company_role_rank(company_id) >= 100
        and coalesce(
          (select r.rank from public.company_roles r where r.key = company_members.role), 0
        ) <= public.company_role_rank(company_id)
      );

    drop policy if exists "company_members_admin_delete" on public.company_members;
    create policy "company_members_admin_delete" on public.company_members
      for delete
      to authenticated
      using (public.company_role_rank(company_id) >= 100);
  end if;

  -- digital_assets exposes storage_path / stripe_product_id / price_cents, so
  -- reads are limited to ACTIVE assets the caller is entitled to (directly or
  -- via an active company membership). Every app reader is entitlement-gated
  -- (lib/actions/assets.ts) or uses the service role (admin pages).
  if to_regclass('public.digital_assets') is not null
     and to_regclass('public.asset_entitlements') is not null
     and to_regprocedure('public.is_company_member(uuid)') is not null then
    alter table public.digital_assets enable row level security;
    drop policy if exists "digital_assets_select_active" on public.digital_assets;
    create policy "digital_assets_select_active" on public.digital_assets
      for select
      to authenticated
      using (
        active
        and exists (
          select 1 from public.asset_entitlements e
          where e.asset_id = digital_assets.id
            and (
              e.user_id = (select auth.uid())
              or (e.company_id is not null and public.is_company_member(e.company_id))
            )
        )
      );
  end if;

  if to_regclass('public.asset_entitlements') is not null
     and to_regprocedure('public.is_company_member(uuid)') is not null then
    alter table public.asset_entitlements enable row level security;
    drop policy if exists "asset_entitlements_select_entitled" on public.asset_entitlements;
    create policy "asset_entitlements_select_entitled" on public.asset_entitlements
      for select
      to authenticated
      using (
        user_id = (select auth.uid())
        or (company_id is not null and public.is_company_member(company_id))
      );
  end if;

  -- admin_audit_log + typeform_budget_intakes: service-role only by design
  -- (no policies; grants revoked in 20260829010000). Re-assert both.
  if to_regclass('public.admin_audit_log') is not null then
    alter table public.admin_audit_log enable row level security;
    revoke all on table public.admin_audit_log from anon, authenticated;
  end if;

  if to_regclass('public.typeform_budget_intakes') is not null then
    alter table public.typeform_budget_intakes enable row level security;
    revoke all on table public.typeform_budget_intakes from anon, authenticated;
  end if;
end $$;


-- =============================================================================
-- 12. storage.objects policies — same semantics, wrapped caller id and
--     `to authenticated`. (Bucket rows/limits are intentionally not touched.)
-- =============================================================================
do $$
begin
  if to_regclass('storage.objects') is not null
     and to_regclass('public.project_files') is not null
     and to_regclass('public.projects') is not null then
    drop policy if exists "project_files_storage_select_own" on storage.objects;
    create policy "project_files_storage_select_own" on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'project-files'
        and exists (
          select 1 from public.project_files pf
          join public.projects p on p.id = pf.project_id
          where pf.storage_path = name
            and p.owner_user_id = (select auth.uid())
        )
      );
  end if;

  if to_regclass('storage.objects') is not null
     and to_regclass('public.work_order_attachments') is not null
     and to_regclass('public.work_orders') is not null then
    drop policy if exists "wo_attachments_storage_select_own" on storage.objects;
    create policy "wo_attachments_storage_select_own" on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'work-order-attachments'
        and exists (
          select 1 from public.work_order_attachments a
          join public.work_orders w on w.id = a.work_order_id
          where a.storage_path = name
            and w.created_by = (select auth.uid())
        )
      );

    drop policy if exists "wo_attachments_storage_insert_own" on storage.objects;
    create policy "wo_attachments_storage_insert_own" on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'work-order-attachments'
        and exists (
          select 1 from public.work_orders w
          where w.created_by = (select auth.uid())
            and name like w.id::text || '/%'
        )
      );

    drop policy if exists "wo_attachments_storage_delete_own" on storage.objects;
    create policy "wo_attachments_storage_delete_own" on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'work-order-attachments'
        and exists (
          select 1 from public.work_order_attachments a
          join public.work_orders w on w.id = a.work_order_id
          where a.storage_path = name
            and w.created_by = (select auth.uid())
        )
      );
  end if;
end $$;


-- =============================================================================
-- 13. Covering indexes for unindexed foreign keys.
--     Each guarded on the table AND column existing.
-- =============================================================================
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('project_files_uploaded_by_idx',           'project_files',           'uploaded_by'),
      ('bookings_lead_idx',                       'bookings',                'lead_id'),
      ('page_events_user_idx',                    'page_events',             'user_id'),
      ('work_orders_invoice_idx',                 'work_orders',             'invoice_id'),
      ('companies_created_by_idx',                'companies',               'created_by'),
      ('company_members_role_idx',                'company_members',         'role'),
      ('company_members_invited_by_idx',          'company_members',         'invited_by'),
      ('asset_entitlements_asset_idx',            'asset_entitlements',      'asset_id'),
      ('admin_audit_log_actor_idx',               'admin_audit_log',         'actor_user_id'),
      ('typeform_budget_intakes_reviewed_by_idx', 'typeform_budget_intakes', 'reviewed_by')
    ) as t(index_name, table_name, column_name)
  loop
    if exists (
      select 1 from pg_attribute
      where attrelid = to_regclass('public.' || r.table_name)
        and attname = r.column_name
        and not attisdropped
    ) then
      execute format(
        'create index if not exists %I on public.%I (%I)',
        r.index_name, r.table_name, r.column_name
      );
    end if;
  end loop;
end $$;
