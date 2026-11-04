Accepted 2026-11-04 (Jeremy W.); implemented in supabase/migrations/20261105000100_suspended_company_reads.sql and supabase/tests/database/suspended_company_reads.test.sql. Applied locally only; production apply is pending (Jeremy, after merge to `main`).

# D44: members of a suspended company can still read company data

Status: option (b) accepted and implemented. The draft SQL and dry-run output that lived here were removed; the migration and pgTAP suite (91 assertions) are the source of truth.

## Problem and current behaviour

`public.is_company_member(cid)` (20260717120000_multi_tenant_companies.sql:77; search_path pinned in 20261022000100) is SECURITY DEFINER and checks only `company_members.status = 'active'` for `auth.uid()`. It never looks at `companies.status`. So after an admin suspends a company (`suspendCompany`), its active members keep reading the company's projects, files, invoices, work orders, attachments, entitled assets and the underlying storage objects through RLS. The write side for member management is already gated (`can_manage_company_members`, D42); reads are not.

## Every policy calling is_company_member (live local DB, pg_policies, 13 rows)

| Table | Policy | Cmd | Kind |
|---|---|---|---|
| public.projects | projects_select_owner_or_company | SELECT | read |
| public.project_files | project_files_select_owner_or_company | SELECT | read |
| public.invoices | invoices_select_owner_or_company | SELECT | read |
| public.work_orders | wo_select_owner_or_company | SELECT | read |
| public.work_orders | wo_insert_own | INSERT | WRITE |
| public.work_order_attachments | wo_att_select_owner_or_company | SELECT | read |
| public.digital_assets | digital_assets_select_active | SELECT | read |
| public.asset_entitlements | asset_entitlements_select_entitled | SELECT | read |
| public.companies | companies_select_member | SELECT | read (the company row itself) |
| public.company_members | company_members_select_comember | SELECT | read (`user_id = auth.uid() OR is_company_member`) |
| storage.objects | project_files_storage_select_owner_or_company | SELECT | read |
| storage.objects | wo_attachments_storage_select_owner_or_company | SELECT | read |
| storage.objects | digital_assets_storage_select_entitled | SELECT | read |

`can_manage_company_members` / `company_role_rank` do not call it. The service role bypasses RLS and is unaffected by any option.

## Options

(a) Add `and exists (select 1 from companies c where c.id = cid and c.status = 'active')` inside `is_company_member`. One-function change, every caller inherits. Cost: it also changes `wo_insert_own` (write) and, critically, `companies_select_member` and `company_members_select_comember`, which are exactly the reads the app uses to detect and explain suspension. Also a silent contract change for any future caller.

(b) New `public.is_active_company_member(cid)` (membership AND active company), used only in the 10 data-read policies (7 public tables plus 3 storage.objects; every row above except `wo_insert_own`, `companies_select_member`, `company_members_select_comember`). `is_company_member` stays membership-only. More statements in the migration, but the blast radius is explicit and pinned by pgTAP.

## Traps

1. `wo_insert_own` (write) calls the function. Under (a) a suspended member can no longer insert a work order for the company; the portal action would fail with a raw RLS error and no remedy (L-018). Under (b) it is unchanged: a suspended member can still insert a work order with `company_id` = their suspended company (pgTAP asserts this as current behaviour). Whether to block it is a separate product decision.
2. `companies_select_member` is load-bearing for the suspended UX. `resolveAdminCompanies` (app/company/_lib/admin-companies.tsx:41-46) reads `companies` with the cookie-bound client and `app/company/layout.tsx:38-47` renders `<SuspendedNotice/>` only when that read returns a row with `status != 'active'`. `guardCompanyPage` (admin-companies.tsx:95) derives "suspended" from the same row, and `requireCompanyAdmin` (lib/actions/company-auth.ts:110-120) reads `companies.status` with the same client. Under (a) the row disappears: `companies.length === 0` and the layout does `redirect("/portal")` (layout.tsx:38-40). The suspended notice becomes dead code and the admin is bounced with no explanation (L-018 regression). layout.test.tsx:127-142 mocks the row, so unit tests would stay green while production breaks. (b) leaves the row readable, so nothing changes in `/company`.
3. `company_members_select_comember` keeps the member's own row via `user_id = auth.uid()` under either option (pgTAP asserts it). Under (a) co-member rows (the other members' names) are hidden from a suspended member; under (b) they remain visible, which is low risk (membership roster, no client data). Not changed by the migration.
4. Owner branches stay: rows a suspended member owns or created (`owner_user_id`, `created_by`, `invoices.user_id`, direct `asset_entitlements.user_id`) remain readable. The gate only removes the company-shared path. This is intended; pgTAP asserts a member still reads a SUS work order they created.
5. Storage must change in the same migration or the bytes stay downloadable via signed URLs / storage API after the tables go dark. The migration includes all three storage SELECT policies.
6. Permissive policies OR together; the migration ends with a raise-if-stray-permissive-SELECT guard (`private.d44_assert_read_policy_set()`, an exact name allowlist, so a policy naming no bucket is caught too) on the seven touched public tables and storage.objects, and pgTAP pins the full policy set of all ten tables (including storage.objects) with `set_eq` (L-006 casts, L-024).

## What a suspended member sees and can do (L-018)

- `/company/*`: unchanged. Layout shows "This company is suspended. Contact Dobeu to reactivate it." with a "Return to your portal" link (admin-companies.tsx SuspendedNotice); pages show the same notice via `guardCompanyPage`. Remedy exists: contact Dobeu; admin reactivates in `/admin/companies` (`reactivateCompany`).
- `/portal/*` (projects, files, invoices, tickets, assets): company-shared rows disappear. Lists show only owned/created rows; opening a company project, ticket or invoice URL gives the page's not-found/empty result; file and asset downloads for company rows fail. The portal shows a "company suspended" banner (components/portal/CompanySuspendedBanner.tsx) that names the suspended company and gives the remedy (contact Dobeu to reactivate it), so empty lists are explained. It reads `companies.status` through `companies_select_member`, which is why that policy stays unchanged (option b).
- Cannot: read company projects/files/invoices/work orders/attachments/assets. Can still: sign in, read own-owned rows, read the company row and own membership, submit a work order (trap 1).

## Recommendation

Adopt (b): ship `is_active_company_member` and switch the 10 data-read policies (7 public tables incl. work_order_attachments, plus 3 storage.objects), leaving `is_company_member`, `companies_select_member`, `company_members_select_comember` and `wo_insert_own` unchanged; with the portal "company suspended" banner shipped alongside.

## Follow-up steps

1. Done: migration copied to `supabase/migrations/20261105000100_suspended_company_reads.sql` (guard extended to storage.objects; since run 20261104-180247 an exact name allowlist, pgTAP-probed with `using (true)` and `bucket_id like ...` policies).
2. Done: `pnpm db:types` run; only the new function appears in `Functions`.
3. Done: applied locally only (production apply is step 5); `pnpm supabase test db` passes for all suites.
4. Done in this PR: portal suspended banner. Still open (separate decision): decide separately whether `wo_insert_own` should also use `is_active_company_member` (then the portal ticket form needs a suspended message first).
5. Production apply PENDING (Jeremy, after merge to `main`): apply via the usual Supabase migration deploy; it is additive and idempotent (create or replace, drop-if-exists + create), no data change. Smoke: suspend a test company in `/admin/companies`, confirm its member sees empty `/portal/projects` plus the suspended banner and the `/company` suspended notice, then reactivate and confirm rows return.
