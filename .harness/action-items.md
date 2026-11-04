# Action items

Things only the user can do or decide. `run` appends rows; `session-lessons.sh` prints rows whose status starts with `open` at session start; `/dts2-harness:action-items` lists them with age, owner and the command that resolves each. Status is `open`, `open, deferred wiring`, or `done`. `owner` is the agent or person who acts next (blank means the user); `added` is an ISO date. Row ids are the group letter plus position: `S1`, `D1`, `H1`, `Y1`, `P1`. Never write a secret's value here.

## Secrets

| name | unlocks | consumed in | how to add | status | owner | added |
|---|---|---|---|---|---|---|
| NEXT_PUBLIC_VERCEL_SUPABASE_URL, NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY, VERCEL_SUPABASE_SERVICE_ROLE_KEY (CI E2E) | e2e/tickets.spec.ts authenticated flow (end-state row 63) | .github/workflows/ci.yml E2E job env | not needed: CI E2E runs a local Supabase stack (run 20261027-151152, Jeremy's choice) | done | Jeremy | 2026-10-27 |

## Decisions

| item | context | status | owner | added |
|---|---|---|---|---|
| Ship verified six-file closeout | runs/20261022-172443/receipt.md; local/mock VERIFIED, no blockers; no commit/push/deploy authorization | done | Jeremy | 2026-10-22 |
| Resolve website-package offer | Approved plan D1: verify or retire $2,995 / 3-week offer; unchanged in this run | done | Jeremy | 2026-10-22 |
| Reconcile form processing disclosure | Approved plan D2: reply-only and opt-in copy versus configured Apollo/Customer.io processing; integrations unchanged, production configuration unverified | done | Jeremy | 2026-10-22 |
| Follow up dialog close focus | Walkthrough W1: focus goes to body after Escape; source unchanged from baseline; separate accessibility follow-up | done | harness lead | 2026-10-22 |
| Restore request-refactor-plan companion | Fixed in dts2-marketplace 318f9cb (3.6.2); merged as dts2-marketplace#3 (59a624d) | done | harness maintainer | 2026-10-22 |
| Approve revised closeout plan | runs/20261022-172443/plan-draft-r2.md; one writer, six owned files, local verification; no commit or deploy | done | Jeremy | 2026-10-22 |
| Reconcile /privacy Customer.io opt-in wording | processLead runs Customer.io identify + lead_captured on every lead; privacy lines 88/113 say opt-in only. Gate on opt-in or revise text | done | Jeremy | 2026-10-27 |
| Retired diagnose companion | mattpocock/skills has no `diagnose` (only diagnosing-bugs); upstream renamed it to diagnosing-bugs; fixed in dts2-marketplace#3 (59a624d, 3.6.2) | done | harness maintainer | 2026-10-27 |
| Live two-user RLS check | rows 37, 38, 42, 43 closed by pgTAP 32/32 (run 20261027-151152); rows 39, 40, 44 closed by rls_files_attachments.test.sql 83/83 (run 20261028-064556) | done | harness lead | 2026-10-27 |
| Agent-writing pass | done 2026-11-03: /writing-for-agents re-run on end-state.md and plan-style.md; per-run evidence moved verbatim to .harness/evidence-log.md; P6 box checked (original pass approved 2026-10-22, state.md) | done |  | 2026-10-27 |
| pgTAP + types-drift CI job | done 2026-11-03: pgTAP in CI since #304; generated types + drift check in CI via #313; end-state row 1 done | done |  | 2026-10-27 |
| Add LEAD_VERIFY_SECRET= line with comment to .env.example (protected path; human edit) — run 20261027-172221 | done 2026-11-03: added by Jeremy (.env.example:80-83, empty value); verified | done |  | 2026-10-27 |
| Add CRON_SECRET= line with comment to .env.example (protected path; human edit) — run 20261027-134130 | done 2026-11-03: added by Jeremy (.env.example:85-87, empty value); verified | done |  | 2026-10-27 |
| Unique index on leads (raw_payload->>'verify_nonce') to close the cross-instance double-confirm race fully (needs migration) — run 20261027-172221 | done 2026-11-04 via #315 (3a9d749): leads_verify_nonce_key + LeadAlreadyConfirmedError -> idempotent 200, no second fan-out; applied to prod | done |  | 2026-10-27 |
| Storage SELECT vs table SELECT for company members (GAP 1) | project_files and work_order_attachments table SELECT include active company members, but storage SELECT on project-files and work-order-attachments is owner-only. Members see rows on /portal/files, /portal/projects/[id], /portal/tickets/[id], but signed URLs and /api/files/[id]/download fail. Decide: widen storage SELECT or narrow table SELECT (migration; update pgTAP cases 1-4 and 23/24) — run 20261028-064556. Fixed: widened storage SELECT (20261103000100), branch fix/storage-gap1-gap2 | done |  | 2026-10-28 |
| Orphan attachment rows on object delete (GAP 2) | owner can delete a work-order-attachments storage object (wo_attachments_storage_delete_own) but no DELETE policy exists on work_order_attachments, leaving an orphan row and a broken link. Decide: add table DELETE policy or drop storage DELETE policy (migration; update pgTAP cases 2/4 and 44/47) — run 20261028-064556. Fixed: dropped storage DELETE policy (20261103000200), branch fix/storage-gap1-gap2 | done |  | 2026-10-28 |
| Optional pgTAP allow-list of all storage.objects policy names | done 2026-11-04 on fix/backlog-d17-d27: D17 full storage.objects policy allow-list in rls_files_attachments.test.sql (pgTAP 137/137) | done |  | 2026-10-28 |
| Fix shared pre-commit hook for worktrees | done 2026-11-04 on fix/backlog-d17-d27: D18 tracked scripts/safe-env.sh resolves repo root via git; .git/hooks/pre-commit rewritten (local); docs/DEPLOYMENT.md install note | done |  | 2026-10-28 |
| Index storage_path on project_files + work_order_attachments | prod has unique indexes from 20261023000300/500; now in the repo too (reconcile 2026-11-03) | done |  | 2026-11-03 |
| Note in 20261022000100 that section 12 is superseded | done 2026-11-04 on fix/backlog-d17-d27: D20 comment-only superseded note in section 12 | done |  | 2026-11-03 |
| Reconcile prod migration history with repo | done 2026-11-03: the 5 prod-only 20261023* migrations added to the repo byte-identical from c5cc3d6 (branch dts2/20261022-084201) with their tests; prod 20260829202624 (= repo 20260829010000, same SQL) relabelled; 10 repo migrations verified in prod schema and marked applied. `migration list --linked` 20/20, `db push --dry-run` up to date | done |  | 2026-11-03 |
| Unmerged branch dts2/20261022-084201 (19 commits ahead of main) | shipped 2026-11-03 via #311 (62cf3e4, Vercel production deploy succeeded; /auth/confirm live); old branches dts2/20261022-084201 and -b1 deleted | done |  | 2026-11-03 |
| Admin dashboard: leads tile count | done 2026-11-04 on fix/backlog-d17-d27: D23 exact count on first_seen >= now-30d; "—" on count error | done |  | 2026-11-03 |
| Lead pipeline logs raw DB error text | done 2026-11-04 on fix/backlog-d17-d27: D24 lib/leads.ts + lead routes log safeErrorFields()/fixed strings only | done |  | 2026-11-03 |
| zod major upgrade for high advisory | done 2026-11-04 on chore/d25-zod4: zod 4.6.7; .uuid() -> z.guid() (keeps lenient ids), enum errorMap -> error; pnpm audit --prod high advisory gone (2 left: moderate postcss-selector-parser, low deepmerge); default zod message wording differs (admin-only text) | done |  | 2026-11-03 |
| Webhook invalid-signature log uses void, not after() | done 2026-11-04 on fix/backlog-d17-d27: D26 after() from next/server; tests prove the log is deferred | done |  | 2026-11-03 |
| Auth confirm: don't silently replace an existing session | done 2026-11-04 on fix/backlog-d17-d27: D27 /auth/confirm page AND /auth/confirm/submit refuse to switch an already-signed-in visitor; SECURITY.md updated | done |  | 2026-11-03 |
| Security: add /company/* to the middleware gate (lib/supabase/middleware.ts); require MFA (AAL2) and check company status = active on company-admin actions (lib/actions/members.ts inviteMember/changeMemberRole/deactivateMember, requireCompanyAdmin) — run 20261103-213646 audit §2/§5 |  | open |  | 2026-11-03 |
| Remove the 200-user cap on the admin user pickers (listUsers perPage 200, page 1 only: app/admin/invoices/page.tsx, app/admin/users/page.tsx, app/admin/tickets/page.tsx) — page through all users or switch to a search picker — run 20261103-213646 | tickets page paginated in the PR #320 fix pass (2026-11-04); invoices + users pages tracked as D36 | done |  | 2026-11-03 |
| Make work-order status changes conditional on the status they read (quoteWorkOrder, updateWorkOrderStatus, acceptWorkOrderQuote in lib/actions/work-orders.ts: add .eq("status", current) and treat zero rows as a conflict; audit previous_status can be stale today) — run 20261103-213646 final review |  | open |  | 2026-11-03 |
| Bring "Bill this work order" (createInvoiceForWorkOrder, lib/actions/invoices.ts) up to the new invoice safeguards: Stripe-failure audit with localInvoiceId, duplicate guard, conditional back-link with linkFailed — run 20261103-213646 final review LOW-1 | done in the PR #320 fix pass (2026-11-04): shared guards + conditional back-link + stripe-failed audit; the missing linkFailed return is D38 | done |  | 2026-11-03 |
| Add void/retry for unsent invoices (stripe_invoice_id null after a Stripe failure): an admin action + button on /admin/invoices; the duplicate-guard message currently points to a manual void in Supabase — run 20261103-213646 |  | open |  | 2026-11-03 |
| De-flake components/landing/LightboxFocus.test.tsx 'returns focus to the opening control when Escape closes the dialog' (Unable to find role=dialog under full-suite load; ~1 in 20 runs; pre-existing, untouched by run 20261103-213646) — can block the pre-commit hook |  | done |  | 2026-11-03 |
| Voided linked invoice still cannot be re-billed from the UI: app/admin/tickets/[id]/page.tsx shows 'Bill this work order' only when !invoice_id and the NewInvoiceDialog picker filters .is('invoice_id', null); show the Bill section / picker entry when the linked invoice status is void, with tests (the server already allows it) — PR #320 fix pass round-3 review H1 (L-018) |  | done |  | 2026-11-04 |
| Stripe idempotency key work-order-invoice:<wo>:v1 (lib/stripe.ts, lib/invoice-creation.ts) never changes, so re-billing a voided work order with a different amount inside Stripe's retention window fails as 'Stripe error' and inserts an unsent row; build the key from the invoice being replaced — PR #320 fix pass round-3 review M1 | PRIORITY RAISED 2026-11-04: round 4 (D34) made re-billing a voided work order reachable from the UI, so this now hits real admins; ticket copy hedged meanwhile | open |  | 2026-11-04 |
| Invoice dialog client list on app/admin/invoices/page.tsx (and app/admin/users/page.tsx) still loads listUsers page 1 x 200; reuse the paginated helper from app/admin/tickets/page.tsx and extract one shared helper with lib/actions/companies.ts and members.ts — PR #320 fix pass round-3 review M2/L6 (L-020) |  | open |  | 2026-11-04 |
| invoice.create_stripe_failed rows are not in BILLING_AUDIT_ACTIONS, so an unsent work-order invoice does not block a retry with a different amount; include non-void stripe-failed rows in workOrderAlreadyInvoiced or document why not — PR #320 fix pass round-3 review M3 |  | open |  | 2026-11-04 |
| createInvoiceForWorkOrder returns plain ok:true when the back-link fails (no linkFailed flag) so AdminCreateInvoiceButton shows nothing; return linkFailed:true and show the notice — PR #320 fix pass round-3 review M4 (L-023) |  | done |  | 2026-11-04 |
| Document the manual Supabase remedies the invoice guard messages point to (set work_orders.invoice_id, set invoices.status = void, read admin_audit_log) in docs/runbooks/admin-and-test-customer.md; add a partial unique index on invoices(stripe_invoice_id) — PR #320 fix pass round-3 review L4/L5 |  | open |  | 2026-11-04 |
| PR #320 round-4 review follow-ups: L1 notice when the linked-invoice read fails on app/admin/tickets/[id]/page.tsx; L2 keep role=status regions mounted before text (AdminCreateInvoiceButton, NewInvoiceDialog); L3 per-read assertions in app/admin/invoices/page.test.tsx; L4 one shared link-failed notice helper; L5 add 'then reload this page'; N1 quoted_amount_cents > 0 check; N2 reuse revalidateInvoicePaths() — pr-fix/review4-opus.md |  | open |  | 2026-11-04 |

## Handoff

| item | context | status | owner | added |
|---|---|---|---|---|
| Complete approved build and verification | Complete; receipt saved to runs/20261022-172443/receipt.md and awaiting ship checkpoint | done | harness lead | 2026-10-22 |
| Review recovered plan and present run checkpoint | Revised plan saved to runs/20261022-172443/plan-draft-r2.md; checkpoint prepared | done | harness lead | 2026-10-22 |
| Live TOTP check for end-state row 46 (MFA settings): sign in on https://dobeu.net as a real portal user, enroll TOTP at /portal/settings/mfa, sign out, sign back in and pass the AAL2 step-up, then tell the harness so row 46 can move to done (needs a human and a real device) |  | open | Jeremy | 2026-11-03 |

## Deploy

| item | context | status | owner | added |
|---|---|---|---|---|
| Apply 20261103000100 + 20261103000200 to production | applied 2026-11-03 to supabase-dobe-net (ipmjokuezeuukhrilduq) via Composio SQL in one transaction and recorded in schema_migrations; prod policies verified (delete_own gone). Live co-member download not yet clicked through | done |  | 2026-11-03 |
| Apply 20261104000100_leads_verify_nonce_unique to production | done 2026-11-04: 0 duplicates re-checked, applied via Composio SQL in one transaction, recorded in schema_migrations; prod index verified; migration list --linked 21/21, db push --dry-run up to date | done |  | 2026-11-04 |

## Promotions

| item | context | status | owner | added |
|---|---|---|---|---|
| promote L-002 to review-checklist.md (verify owned-file sha256 before reusing test results from a worktree or after a polish pass) |  | done |  | 2026-10-28 |
| promote L-003 to review-checklist.md (dialog close vs focus restoration) |  | done |  | 2026-11-03 |
| promote L-010 to review-checklist.md (rebase --onto origin/main after a squash-merged base) |  | done |  | 2026-11-03 |
| promote L-012 to review-checklist.md (grep SECURITY.md/docs/.harness when closing a documented gap) |  | done |  | 2026-11-03 |
| promote L-004 to review-checklist.md (builder seat capability + skipped rules file recorded in receipt) |  | open |  | 2026-11-03 |
| promote L-021 to review-checklist.md (async submit button state asserted in waitFor; focus flake = check disabled target) |  | open |  | 2026-11-03 |
