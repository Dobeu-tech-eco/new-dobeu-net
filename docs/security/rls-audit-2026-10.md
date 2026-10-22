# RLS and database-advisor audit (2026-10)

- **Date:** 2026-10-22
- **Method:** static read of every file in `supabase/migrations/` (`20260521000000` to `20260829010000`), replayed in order to get the effective policy set, then cross-checked against callers in `lib/actions/**` and `app/api/**`. The Supabase MCP and live advisors were **not** available, and the live schema has not been diffed against migrations yet (S2). Findings describe the schema the migrations produce, not production.
- **Fix:** `supabase/migrations/20261022000100_rls_advisor_hardening.sql`
- **Tests:** `lib/rls-migration.test.ts` (static, runs in CI) and `supabase/tests/database/rls_hardening.test.sql` (pgTAP, run with `pnpm supabase test db` against the local Docker stack).

## Access model (unchanged)

- Admin reads and writes use `createAdminClient()` (service role, bypasses RLS) behind the `ADMIN_EMAILS` gate. RLS only governs the cookie-bound `authenticated` client and `anon`.
- Clients read their own rows. Active company members also get read-only access to company-scoped rows (`projects`, `work_orders`, and through them `project_files`, `invoices`, `work_order_attachments`).
- Clients write only `profiles` (own row), `work_orders` and `work_order_attachments` (insert), and `company_members` (company admins only).

## Table audit

Legend: S/I/U/D = select/insert/update/delete. "uid wrapped" means every caller-id reference in the policy is `(select auth.uid())` (advisor `auth_rls_initplan`). "FK index" lists foreign keys that had no covering index.

| Table | RLS on | Policies per command (before) | USING / WITH CHECK | uid wrapped | FK index | Finding | Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `profiles` | yes | S: `profiles_select_own`; U: `profiles_update_own` | U has both (since 20260717053750) | S no, U yes | ok (PK = FK) | F1: bare uid in SELECT, no `to` role | recreated with wrapped uid, `to authenticated` |
| `projects` | yes | S: `projects_select_own` + `projects_select_company` | S only | no | ok | F1; F2: 2 permissive SELECT policies | merged into `projects_select_owner_or_company` |
| `project_files` | yes | S: `project_files_select_own` + `project_files_select_company` | S only | no | `uploaded_by` missing | F1; F2; F7 | merged into `project_files_select_owner_or_company`; `project_files_uploaded_by_idx` |
| `invoices` | yes | S: `invoices_select_own` + `invoices_select_company` | S only | no | ok (`project_id`, `user_id`) | F1; F2 | merged into `invoices_select_owner_or_company` |
| `leads` | yes | none (anon insert dropped 20260717064702) | n/a | n/a | n/a | F6: anon/authenticated keep default table grants (exposed in the API schema with no use) | re-drops legacy policies; `revoke all ... from anon, authenticated` |
| `bookings` | yes | none (anon insert dropped 20260717064702) | n/a | n/a | `lead_id` missing | F6; F7 | revoke grants; `bookings_lead_idx` |
| `page_events` | yes | I: `page_events_insert_anon` `with check (true)`, no `to` role | I: `true` | n/a | `user_id` missing | F5: unauthenticated, un-rate-limited insert with no app writer (no code references `page_events`); F7 | policy dropped; grants revoked (service-role only); `page_events_user_idx` |
| `work_orders` | yes | S: `wo_select_own` + `wo_select_company`; I: `wo_insert_own` | I: `created_by` only | no | `invoice_id` missing | F1; F2; F4: a client can insert directly through PostgREST with `company_id` of any company (shows up in that tenant's view), a pre-set `status='quoted'` + `quoted_amount_cents`, `invoice_id`, or another user's `project_id`; F7 | merged SELECT; `wo_insert_own` now requires the `open` state, null quote/accept/invoice/milestone columns, own-company `company_id`, own `project_id`; `work_orders_invoice_idx` |
| `work_order_attachments` | yes | S: `wo_att_select_own` + `wo_attachments_select_company`; I: `wo_att_insert_own` | I: ownership only | no | ok | F1; F2; F4b: `storage_path` not bound to the work-order namespace in RLS (code checks it) | merged SELECT; insert also requires `storage_path like work_order_id || '/%'` |
| `companies` | yes | S: `companies_select_member` | S only | n/a (helper) | `created_by` missing | F3: no `to` role, so anon evaluates the helper; F7 | `to authenticated`; `companies_created_by_idx` |
| `company_roles` | yes | S: `company_roles_select_authed` (`auth.uid() is not null`) | S only | no | n/a | F1 | wrapped uid, `to authenticated` |
| `company_members` | yes | S: `..._select_comember`; I/U/D: `..._admin_*` (rank >= 100) | U has both | S no | `role`, `invited_by` missing | F1; F3; F7 | recreated with wrapped uid + `to authenticated`; `company_members_role_idx`, `company_members_invited_by_idx` |
| `digital_assets` | yes | S: `digital_assets_select_active` | S only | no | n/a | F1 | wrapped uid, `to authenticated` |
| `asset_entitlements` | yes | S: `asset_entitlements_select_entitled` | S only | no | `asset_id` missing | F1; F7 | wrapped uid; `asset_entitlements_asset_idx` |
| `admin_audit_log` | yes | none (service role only), grants revoked | n/a | n/a | `actor_user_id` missing | F7 | re-assert RLS + revoke; `admin_audit_log_actor_idx` |
| `typeform_budget_intakes` | yes | none (service role only), grants revoked | n/a | n/a | `reviewed_by` missing | F7 | re-assert RLS + revoke; `typeform_budget_intakes_reviewed_by_idx` |
| `messages` | n/a | n/a | n/a | n/a | n/a | Dropped in 20260605000000; listed only because it was in the initial schema | none |

All 16 tables in the requested list exist in migrations. `messages` is the only historical table that no longer exists.

## storage.objects policies

| Policy | Bucket | Cmd | Finding | Fix |
| --- | --- | --- | --- | --- |
| `project_files_storage_select_own` | `project-files` | S | F1 (bare uid), no `to` role | recreated with wrapped uid, `to authenticated` |
| `wo_attachments_storage_select_own` | `work-order-attachments` | S | F1, no `to` role | recreated |
| `wo_attachments_storage_insert_own` | `work-order-attachments` | I | F1, no `to` role (the `<work_order_id>/` prefix check is kept) | recreated |
| `wo_attachments_storage_delete_own` | `work-order-attachments` | D | F1, no `to` role | recreated |
| (none) | `digital-assets` | S | D1: `getAssetDownloadUrl` (`lib/actions/assets.ts`) signs URLs with the cookie-bound client, but no migration creates the bucket or a storage policy for it | **deferred**, see below |

`storage.buckets` is not touched. Bucket rows and limits belong to a separate change.

## Functions

| Function | Security | search_path before | EXECUTE before | Fix |
| --- | --- | --- | --- | --- |
| `set_updated_at()` | invoker (trigger) | **unset** (advisor `function_search_path_mutable`) | PUBLIC | `pg_catalog, public`; revoke from public/anon/authenticated |
| `handle_new_user()` | **definer** (trigger) | `public` | PUBLIC | `pg_catalog, public, pg_temp`; revoke from public/anon/authenticated |
| `is_company_member(uuid)` | **definer** | `public` | PUBLIC + anon | `pg_catalog, public, pg_temp`; revoke public/anon; **authenticated + service_role keep EXECUTE** |
| `company_role_rank(uuid)` | **definer** | `public` | PUBLIC + anon | same as above |
| `enforce_typeform_budget_intake_state()` | invoker (trigger) | `pg_catalog, public` | already revoked | re-pinned (no-op) |
| `audit_typeform_budget_intake_review()` | **definer** (trigger) | `pg_catalog, public` | already revoked | `pg_catalog, public, pg_temp` |

Rationale:

- **`pg_temp` last.** When `pg_temp` is not listed, Postgres searches it *first* for relations. Putting it last explicitly closes temp-table shadowing in definer functions.
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

## UPDATE policies

After this migration only two client UPDATE policies exist: `profiles_update_own` and `company_members_admin_update`. Both have USING and WITH CHECK. `work_orders` has no client UPDATE policy: it was intentionally removed in 20260717064702, and every transition runs through the service role.

## Deferred (not fixed here, needs a decision)

- **D1, `digital-assets` storage read.** No bucket and no `storage.objects` policy exist in migrations, yet `getAssetDownloadUrl` signs with the user client. Either the bucket and policy were created out-of-band, or entitled downloads fail today. This needs the bucket owner (storage.buckets change) to add an entitled-read policy, or the action should sign with the service role after its RLS entitlement check.
- **D2, company-member storage reads.** The table RLS lets company members read `project_files` and `work_order_attachments` rows, but the storage policies only allow the owner. So `/api/files/[id]/download` and portal ticket attachments return no signed URL for co-members. Widening storage access is a product decision, so it is left owner-only.
- **D3, project-less company invoices.** `invoices_select_owner_or_company` widens to company members only through `project_id`. A work-order invoice with `project_id = null` stays visible only to `user_id`, matching prior behaviour.
- **D4, redundant index.** `company_members_company_idx` duplicates the leading column of `unique (company_id, user_id)`. It was not dropped, because this migration only adds indexes.
- **D5, live verification.** Run `supabase db advisors` (CLI >= 2.81.3) or MCP `get_advisors` against production after S2 and this migration land, and diff `pg_policies` against this document.
