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
| Live two-user RLS check | rows 37, 38, 42, 43 closed by pgTAP 32/32 on a local stack, which now also runs in CI (run 20261027-151152). Still open, rows 39, 40, 44: add two-user pgTAP for project_files and work_order_attachments | open |  | 2026-10-27 |
| Agent-writing pass | P6 box open: run or record the setup agent-writing pass (writing-for-agents) and its approval | open |  | 2026-10-27 |
| pgTAP + types-drift CI job | end-state row 1: add CI job (supabase start, supabase test db, gen types diff); deferred by Jeremy 2026-10-27 | open |  | 2026-10-27 |
| Add LEAD_VERIFY_SECRET= line with comment to .env.example (protected path; human edit) — run 20261027-172221 |  | open |  | 2026-10-27 |
| Unique index on leads (raw_payload->>'verify_nonce') to close the cross-instance double-confirm race fully (needs migration) — run 20261027-172221 |  | open |  | 2026-10-27 |

## Handoff

| item | context | status | owner | added |
|---|---|---|---|---|
| Complete approved build and verification | Complete; receipt saved to runs/20261022-172443/receipt.md and awaiting ship checkpoint | done | harness lead | 2026-10-22 |
| Review recovered plan and present run checkpoint | Revised plan saved to runs/20261022-172443/plan-draft-r2.md; checkpoint prepared | done | harness lead | 2026-10-22 |

## Deploy

| item | context | status | owner | added |
|---|---|---|---|---|

## Promotions

| item | context | status | owner | added |
|---|---|---|---|---|
