# RLS and database-advisor audit (2026-10)

- **Date:** 2026-10-22
- **Method:** static read of every file in `supabase/migrations/` (`20260521000000` to `20260829010000`), replayed in order to get the effective policy set, then cross-checked against callers in `lib/actions/**` and `app/api/**`. The Supabase MCP and live advisors were **not** available, and the live schema has not been diffed against migrations yet (S2). Findings describe the schema the migrations produce, not production.
- **Fix:** `supabase/migrations/20261022000100_rls_advisor_hardening.sql`
- **Follow-up (Run 2, 2026-10-23):** `20261023000100_digital_assets_storage.sql` (D1), `20261023000200_drop_company_members_company_idx.sql` (D4), `20261023000300_project_files_storage_path_unique.sql`, `20261023000400_company_storage_select.sql` (D2), `20261023000500_storage_path_unique_indexes.sql`. See "Run 2 follow-up" below.
- **Tests:** `lib/rls-migration.test.ts` and `lib/run2-migrations.test.ts` (static, run in CI), `supabase/tests/database/rls_hardening.test.sql` and `supabase/tests/database/run2_storage.test.sql` (pgTAP, run with `pnpm supabase test db` against the local Docker stack).

## Access model (unchanged)

- Admin reads and writes use `createAdminClient()` (service role, bypasses RLS) behind the `ADMIN_EMAILS` gate. RLS only governs the cookie-bound `authenticated` client and `anon`.
- Clients read their own rows. Active company members also get read-only access to company-scoped rows (`projects`, `work_orders`, and through them `project_files`, `invoices`, `work_order_attachments`).
- Clients write only `profiles` (own row), `work_orders` and `work_order_attachments` (insert), and `company_members` (company admins only).

## Table audit

Legend: S/I/U/D = select/insert/update/delete. "uid wrapped" means every caller-id reference in the policy is `(select auth.uid())` (advisor `auth_rls_initplan`). "FK index" lists foreign keys that had no covering index.

| Table | RLS on | Policies per command (before) | USING / WITH CHECK | uid wrapped | FK index | Finding | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `profiles` | yes | S: `profiles_select_own`; U: `profiles_update_own` | U has both (since 20260717053750) | S no, U yes | ok (PK = FK) | F1: bare uid in SELECT, no `to` role; F8: client could write `stripe_customer_id` / `apollo_contact_id` (row-level policy cannot restrict columns) | recreated with wrapped uid, `to authenticated`; INSERT/UPDATE/DELETE revoked from anon/authenticated, UPDATE re-granted only on `full_name, company, phone, notify_email` (the `updateProfile` column list) |
| `projects` | yes | S: `projects_select_own` + `projects_select_company` | S only | no | ok | F1; F2: 2 permissive SELECT policies | merged into `projects_select_owner_or_company` |
| `project_files` | yes | S: `project_files_select_own` + `project_files_select_company` | S only | no | `uploaded_by` missing | F1; F2; F7 | merged into `project_files_select_owner_or_company`; `project_files_uploaded_by_idx` |
| `invoices` | yes | S: `invoices_select_own` + `invoices_select_company` | S only | no | ok (`project_id`, `user_id`) | F1; F2 | merged into `invoices_select_owner_or_company` |
| `leads` | yes | none (anon insert dropped 20260717064702) | n/a | n/a | n/a | F6: anon/authenticated keep default table grants (exposed in the API schema with no use) | re-drops legacy policies; `revoke all ... from anon, authenticated` |
| `bookings` | yes | none (anon insert dropped 20260717064702) | n/a | n/a | `lead_id` missing | F6; F7 | revoke grants; `bookings_lead_idx` |
| `page_events` | yes | I: `page_events_insert_anon` `with check (true)`, no `to` role | I: `true` | n/a | `user_id` missing | F5: unauthenticated, un-rate-limited insert with no app writer (no code references `page_events`); F7 | policy dropped; grants revoked (service-role only); `page_events_user_idx` |
| `work_orders` | yes | S: `wo_select_own` + `wo_select_company`; I: `wo_insert_own` | I: `created_by` only | no | `invoice_id` missing | F1; F2; F4: a client can insert directly through PostgREST with `company_id` of any company (shows up in that tenant's view), a pre-set `status='quoted'` + `quoted_amount_cents`, `invoice_id`, or another user's `project_id`; F7 | merged SELECT; `wo_insert_own` now requires the `open` state, null quote/accept/invoice (and milestone, when those columns exist) columns, own-company `company_id`, own `project_id` whose `company_id` equals the work order's `company_id` (F9; enforced in every schema-drift variant that has `company_id`); `work_orders_invoice_idx` |
| `work_order_attachments` | yes | S: `wo_att_select_own` + `wo_attachments_select_company`; I: `wo_att_insert_own` | I: ownership only | no | ok | F1; F2; F4b: `storage_path` not bound to the work-order namespace in RLS (code checks it) | merged SELECT; insert also requires `storage_path like work_order_id \|\| '/%'` |
| `companies` | yes | S: `companies_select_member` | S only | n/a (helper) | `created_by` missing | F3: no `to` role, so anon evaluates the helper; F7 | `to authenticated`; `companies_created_by_idx` |
| `company_roles` | yes | S: `company_roles_select_authed` (`auth.uid() is not null`) | S only | no | n/a | F1 | wrapped uid, `to authenticated` |
| `company_members` | yes | S: `..._select_comember`; I/U/D: `..._admin_*` (rank >= 100) | U has both | S no | `role`, `invited_by` missing | F1; F3; F7; F10: an admin could rewrite `user_id`/`company_id` or insert any user as an active admin | column-level grants: UPDATE only `(role, status)`, INSERT only `(company_id, user_id, role, status, invited_by)`; insert policy also requires `status = 'invited'` and `invited_by = auth.uid()`; a BEFORE trigger (`enforce_company_member_activation`) rejects any transition to `active` by `anon`/`authenticated` (F12); insert and update both cap the assigned role's rank at the caller's own; wrapped uid + `to authenticated`; `company_members_role_idx`, `company_members_invited_by_idx` |
| `digital_assets` | yes | S: `digital_assets_select_active` | S only | no | n/a | F1; F11: every signed-in user could read `storage_path`, `stripe_product_id`, `price_cents` of every active asset | select now requires `active` AND an entitlement (own user grant or active company membership); wrapped uid, `to authenticated` |
| `asset_entitlements` | yes | S: `asset_entitlements_select_entitled` | S only | no | `asset_id` missing | F1; F7 | wrapped uid; `asset_entitlements_asset_idx` |
| `admin_audit_log` | yes | none (service role only), grants revoked | n/a | n/a | `actor_user_id` missing | F7 | re-assert RLS + revoke; `admin_audit_log_actor_idx` |
| `typeform_budget_intakes` | yes | none (service role only), grants revoked | n/a | n/a | `reviewed_by` missing | F7 | re-assert RLS + revoke; `typeform_budget_intakes_reviewed_by_idx` |
| `messages` | n/a | n/a | n/a | n/a | n/a | Dropped in 20260605000000; listed only because it was in the initial schema | none |

All 16 tables in the requested list exist in migrations. `messages` is the only historical table that no longer exists.

## storage.objects policies

| Policy | Bucket | Cmd | Finding | Fix |
| --- | --- | --- | --- | --- |
| `project_files_storage_select_own` | `project-files` | S | F1 (bare uid), no `to` role | recreated with wrapped uid, `to authenticated`; **replaced in Run 2** by `project_files_storage_select_owner_or_company` (D2) |
| `wo_attachments_storage_select_own` | `work-order-attachments` | S | F1, no `to` role | recreated; **replaced in Run 2** by `wo_attachments_storage_select_owner_or_company` (D2) |
| `wo_attachments_storage_insert_own` | `work-order-attachments` | I | F1, no `to` role (the `<work_order_id>/` prefix check is kept) | recreated |
| `wo_attachments_storage_delete_own` | `work-order-attachments` | D | F1, no `to` role | recreated |
| (none) | `digital-assets` | S | D1: `getAssetDownloadUrl` (`lib/actions/assets.ts`) signs URLs with the cookie-bound client, but no migration creates the bucket or a storage policy for it | **fixed in Run 2**: `digital_assets_storage_select_entitled` (see below) |

`20261022000100` does not touch `storage.buckets`. The Run 2 migration `20261023000100` creates `digital-assets` and forces it private.

## Functions

| Function | Security | search_path before | EXECUTE before | Fix |
| --- | --- | --- | --- | --- |
| `set_updated_at()` | invoker (trigger) | **unset** (advisor `function_search_path_mutable`) | PUBLIC | `pg_catalog, public`; revoke from public/anon/authenticated |
| `handle_new_user()` | **definer** (trigger) | `public` | PUBLIC | `pg_catalog, public, pg_temp`; revoke from public/anon/authenticated |
| `is_company_member(uuid)` | **definer** | `public` | PUBLIC + anon | `pg_catalog, public, pg_temp`; revoke public/anon; **authenticated + service_role keep EXECUTE** |
| `company_role_rank(uuid)` | **definer** | `public` | PUBLIC + anon | same as above |
| `enforce_typeform_budget_intake_state()` | invoker (trigger) | `pg_catalog, public` | already revoked | re-pinned (no-op); EXECUTE re-revoked from public/anon/authenticated if the function exists |
| `audit_typeform_budget_intake_review()` | **definer** (trigger) | `pg_catalog, public` | already revoked | `pg_catalog, public, pg_temp`; EXECUTE re-revoked as above |

Rationale:

- **`pg_temp` listed explicitly last on SECURITY DEFINER functions.** Round 2 dropped it, which was a regression: when `pg_temp` is not named in `search_path`, Postgres searches the temporary schema FIRST for relations and types. The documented safe form (CREATE FUNCTION, "Writing SECURITY DEFINER Functions Safely") is to name it last, `pg_catalog, public, pg_temp`. The four definer functions use that form. SECURITY INVOKER functions (`set_updated_at`, `enforce_typeform_budget_intake_state`, `enforce_company_member_activation`) keep `pg_catalog, public`, since they run with the caller's own privileges. Bodies are also schema-qualified (`public.*`, `auth.uid()`).
- **Why not an empty path.** `search_path = ''` was considered and rejected. The live function bodies have not been diffed (S2), and a drifted `handle_new_user` with an unqualified table name would break every signup.
- **Why `authenticated` keeps EXECUTE on the membership helpers.** RLS policies run their expressions as the querying role. Revoking it would turn every company-scoped read into `permission denied for function`. After this migration every policy that calls the helpers is `to authenticated`, so anon never evaluates them and can safely lose EXECUTE.

## Finding key

- **F1:** a bare `auth.uid()` in a policy is re-evaluated per row. Wrapping it in `(select ...)` lets the planner evaluate it once per statement.
- **F2:** more than one permissive policy for the same role and command (advisor `multiple_permissive_policies`). Postgres evaluates and ORs every one of them on every row.
- **F3:** no `TO` clause, so the policy also applies to `anon`. That is harmless for row visibility, but it forces anon to execute SECURITY DEFINER helpers.
- **F4:** the client INSERT policy is too permissive for the columns that matter (see the table).
- **F5:** an anon INSERT with `with check (true)`.
- **F6:** a service-role-only table still grants API roles.
- **F7:** an unindexed foreign key (advisor `unindexed_foreign_keys`).
- **F8:** a row-level UPDATE policy cannot limit columns, so the client could set Stripe/Apollo ids on its own profile and make `getOrCreateStripeCustomer` (which trusts the cached id) invoice a foreign Stripe customer. Fixed with column-level privileges.
- **F9:** a work order could pair a company the caller belongs to with a project owned by the caller but belonging to a different company, leaking that project id into the first company's view.
- **F10:** `company_members` insert/update checks only tested the caller's rank, so `user_id`/`company_id` were rewritable. `inviteMember` inserts through the cookie-bound client, so the insert policy stays but is constrained; `changeMemberRole` / `deactivateMember` only write `role` / `status`.
- **F12:** an active company admin could mint an active `company_admin` in two steps: insert an `invited` row, then UPDATE `status='active'`. A WITH CHECK cannot tell a role edit on an already-active row from a transition to active (it sees only the new row), so the block is a trigger that compares OLD and NEW. Activation is service-role only.
- **F11:** `digital_assets` select was not entitlement-scoped.

## UPDATE policies

After this migration only two client UPDATE policies exist: `profiles_update_own` and `company_members_admin_update`. Both have USING and WITH CHECK, and both are further limited by column-level UPDATE grants (`profiles`: `full_name, company, phone, notify_email`; `company_members`: `role, status`). `service_role` keeps full table privileges. `work_orders` has no client UPDATE policy: it was intentionally removed in 20260717064702, and every transition runs through the service role.

## Deferred (not fixed here, needs a decision)

- **D1, `digital-assets` storage read (CLOSED, Run 2).** `20261023000100` creates the bucket private (`on conflict (id) do update set public = false`, so a dashboard-created public bucket is forced private) and adds `digital_assets_storage_select_entitled`. That policy allows SELECT to `authenticated` for an ACTIVE `digital_assets` row whose `storage_path` equals the object name, with an entitlement by user or by active company membership. It adds no write policy. `getAssetDownloadUrl` signs with `{ download: true }`.
- **D2, company-member storage reads (CLOSED, Run 2, decision: option A).** `20261023000400` replaces the owner-only storage SELECT policies with `project_files_storage_select_owner_or_company` and `wo_attachments_storage_select_owner_or_company`, which mirror the table policies: owner, or active member of the project's or work order's company. SELECT only; `wo_attachments_storage_insert_own` / `_delete_own` are unchanged.
- **R1, company admin invite/activate (CLOSED).** A company admin can still insert any registered user as an `invited` member (that is the `inviteMember` feature, bounded to their own company and to roles at or below their own rank), but can no longer activate anyone: `enforce_company_member_activation` rejects, for `anon`/`authenticated`, any INSERT with `status='active'` and any UPDATE moving a row from a non-active status to `active`. Role edits on already-active rows and `active` to `disabled` are unaffected. Checked callers: `inviteMember` inserts `invited`, `changeMemberRole` writes `role`, `deactivateMember` writes `disabled`, and `provisionCompanyAdmin` (the only writer of `active`) uses the service role. No cookie-bound path sets `active`, and no accept-invite flow exists, so there is no invitee self-accept path to preserve. If one is added later, it needs a narrow service-role action (or a trigger exception for `user_id = auth.uid()`, `invited` to `active`, role unchanged).
- **R2, entitled users see `storage_path`.** Entitled users can read their asset's `storage_path`. Since D1 closed, it maps to exactly the object they are already entitled to read: `digital_assets.storage_path` is unique (`20261023000500`), so a path cannot widen to another audience.
- **D3, project-less company invoices.** `invoices_select_owner_or_company` widens to company members only through `project_id`. A work-order invoice with `project_id = null` stays visible only to `user_id`, matching prior behaviour.
- **D4, redundant index (CLOSED, Run 2).** `company_members_company_idx` duplicated the leading column of `unique (company_id, user_id)` (`company_members_company_id_user_id_key`). `20261023000200` drops it, after a guard confirms that a unique index leading with `company_id` exists.
- **D5, live verification.** Run `supabase db advisors` (CLI >= 2.81.3) or MCP `get_advisors` against production after S2 and this migration land, and diff `pg_policies` against this document.

## Run 2 follow-up (2026-10-23)

storage.objects policies after `20261023000100`–`000500`:

| Policy | Bucket | Cmd | Role | Rule |
| --- | --- | --- | --- | --- |
| `project_files_storage_select_owner_or_company` | `project-files` | S | authenticated | a `project_files` row with `storage_path = name` whose project is owned by the caller or belongs to a company the caller is an active member of |
| `wo_attachments_storage_select_owner_or_company` | `work-order-attachments` | S | authenticated | a `work_order_attachments` row with `storage_path = name` whose work order was created by the caller or belongs to a company the caller is an active member of |
| `wo_attachments_storage_insert_own` | `work-order-attachments` | I | authenticated | unchanged |
| `wo_attachments_storage_delete_own` | `work-order-attachments` | D | authenticated | unchanged |
| `digital_assets_storage_select_entitled` | `digital-assets` | S | authenticated | an ACTIVE `digital_assets` row with `storage_path = name`, entitled to the caller directly or through an active company membership |

No UPDATE policy was added; column-level write scope is unchanged.

Indexes:

| Index | Change | Why |
| --- | --- | --- |
| `company_members_company_idx` | dropped | redundant with `company_members_company_id_user_id_key` (D4) |
| `project_files_storage_path_key` | new, unique | one row per object; serves the storage policy lookup. `recordDeliverable` maps this constraint's 23505 to `storage_path already recorded` |
| `digital_assets_storage_path_key` | new, unique | stops two asset rows from unioning their audiences over one object; serves the policy lookup |
| `work_order_attachments_storage_path_key` | new, unique | same, for attachments |

Each unique index is preceded by a guard that raises with the duplicate count, so it never skips silently. If a table or function a policy depends on is missing, the migration raises an exception instead of being recorded as applied.
