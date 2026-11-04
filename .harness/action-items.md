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
| Unique index on leads (raw_payload->>'verify_nonce') to close the cross-instance double-confirm race fully (needs migration) — run 20261027-172221 |  | open |  | 2026-10-27 |
| Storage SELECT vs table SELECT for company members (GAP 1) | project_files and work_order_attachments table SELECT include active company members, but storage SELECT on project-files and work-order-attachments is owner-only. Members see rows on /portal/files, /portal/projects/[id], /portal/tickets/[id], but signed URLs and /api/files/[id]/download fail. Decide: widen storage SELECT or narrow table SELECT (migration; update pgTAP cases 1-4 and 23/24) — run 20261028-064556. Fixed: widened storage SELECT (20261103000100), branch fix/storage-gap1-gap2 | done |  | 2026-10-28 |
| Orphan attachment rows on object delete (GAP 2) | owner can delete a work-order-attachments storage object (wo_attachments_storage_delete_own) but no DELETE policy exists on work_order_attachments, leaving an orphan row and a broken link. Decide: add table DELETE policy or drop storage DELETE policy (migration; update pgTAP cases 2/4 and 44/47) — run 20261028-064556. Fixed: dropped storage DELETE policy (20261103000200), branch fix/storage-gap1-gap2 | done |  | 2026-10-28 |
| Optional pgTAP allow-list of all storage.objects policy names | final review LOW, run 20261028-064556: cases 3/4 find policies by bucket-name text, so a new policy naming neither bucket escapes them | open |  | 2026-10-28 |
| Fix shared pre-commit hook for worktrees | .git/hooks/pre-commit calls .harness/runs/20261022-172443/v0/safe-env.sh by a relative, gitignored path; commits from harness worktrees fail. Resolve via repo root or move the script to a tracked path — run 20261028-064556 | open |  | 2026-10-28 |
| Index storage_path on project_files + work_order_attachments | prod has unique indexes from 20261023000300/500; now in the repo too (reconcile 2026-11-03) | done |  | 2026-11-03 |
| Note in 20261022000100 that section 12 is superseded | security review LOW, run 20261103-gaps: hand re-applying it would recreate wo_attachments_storage_delete_own (GAP 2); CI catalog case 4 would catch it | open |  | 2026-11-03 |
| Reconcile prod migration history with repo | done 2026-11-03: the 5 prod-only 20261023* migrations added to the repo byte-identical from c5cc3d6 (branch dts2/20261022-084201) with their tests; prod 20260829202624 (= repo 20260829010000, same SQL) relabelled; 10 repo migrations verified in prod schema and marked applied. `migration list --linked` 20/20, `db push --dry-run` up to date | done |  | 2026-11-03 |
| Unmerged branch dts2/20261022-084201 (19 commits ahead of main) | shipped 2026-11-03 via #311 (62cf3e4, Vercel production deploy succeeded; /auth/confirm live); old branches dts2/20261022-084201 and -b1 deleted | done |  | 2026-11-03 |
| Admin dashboard: leads tile count | review of port PR, 2026-11-03: app/admin/page.tsx "New leads (30d)" = length of a .limit(10) undated query (invoices/users/projects aux-failure and header issues fixed in the port PR) | open |  | 2026-11-03 |
| Lead pipeline logs raw DB error text | lib/leads.ts, app/api/lead/route.ts, app/api/lead/confirm/route.ts log error.message / error objects to stderr (drained to Datadog); switch to safeErrorFields() from lib/log-safe.ts | open |  | 2026-11-03 |
| zod major upgrade for high advisory | pnpm audit: zod ^3.25.76 memory-exhaustion advisory fixed only in 4.6.6 (major bump); separate PR | open |  | 2026-11-03 |
| Webhook invalid-signature log uses void, not after() | port PR: fire-and-forget Datadog log on forged webhooks may be dropped when the function freezes; switch to next/server after() if those logs matter | open |  | 2026-11-03 |
| Auth confirm: don't silently replace an existing session | security review LOW: login CSRF via attacker's own magic link (accepted risk in SECURITY.md); optional mitigation shows "already signed in as X" on /auth/confirm | open |  | 2026-11-03 |

## Handoff

| item | context | status | owner | added |
|---|---|---|---|---|
| Complete approved build and verification | Complete; receipt saved to runs/20261022-172443/receipt.md and awaiting ship checkpoint | done | harness lead | 2026-10-22 |
| Review recovered plan and present run checkpoint | Revised plan saved to runs/20261022-172443/plan-draft-r2.md; checkpoint prepared | done | harness lead | 2026-10-22 |

## Deploy

| item | context | status | owner | added |
|---|---|---|---|---|
| Apply 20261103000100 + 20261103000200 to production | applied 2026-11-03 to supabase-dobe-net (ipmjokuezeuukhrilduq) via Composio SQL in one transaction and recorded in schema_migrations; prod policies verified (delete_own gone). Live co-member download not yet clicked through | done |  | 2026-11-03 |

## Promotions

| item | context | status | owner | added |
|---|---|---|---|---|
| promote L-002 to review-checklist.md (verify owned-file sha256 before reusing test results from a worktree or after a polish pass) |  | open |  | 2026-10-28 |
