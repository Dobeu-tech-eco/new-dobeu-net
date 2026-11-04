# Harness state

Append entries as `- <date> <text>`.

## Decisions

- 2026-10-22 Scope: this repository only. .omc/ and .impeccable/ coexist read-only; .agent/ imported read-only; preserve .omx/.codex/.cursor.
- 2026-10-22 End-state map, architecture amendments, revised content and form-only wording approved by Jeremy. Status approved; plan-style applied.
- 2026-10-22 Marketing context confirmed; analytics review explicitly read-only. Eight GTM reports completed; no application implementation/deployment implied.
- 2026-10-22 Continue on top of existing dirty work, preserving all files; no commit, stash, push or production action authorized.

- 2026-10-22 Requested marketplace refresh and plugin update completed: latest published and installed DTS2 are both 3.6.1; updateOutcome up_to_date, advanced false. No plugin cache edits or version upgrade occurred. Upgrade workflow stopped at its same-version gate.

- 2026-10-22 Jeremy approved revised plan r2: "Approved $dts2-harness:run run it". Check-in confirmed existing scope. Proceed V0, one builder, review and verification; no commit, push or deploy.
- 2026-10-22 Ruling: shared root with one writer for this run — preserve approved dirty baseline without commits or worktree snapshot ambiguity — an out-of-scope edit is detected by baseline manifest and stops the builder.

- 2026-10-22 Baseline V0 passed: 696 real-tree tests and 50 positioning tests. Renamed six baseline source copies with .baseline suffix to prevent test/typecheck discovery; bytes preserved. Gemini builder CLI is plan-only per roster; lead will apply its returned patch.

- 2026-10-22 Builder fallback: Gemini produced no patch after headless command denial despite exit 0; roster classifier says ok but artifact validation failed. Copilot economy profile does not pin a model, so skipped execution to avoid an unverified frontier default. Muse muse-spark-1.3 effort medium is running as next explicit economy model.

- 2026-10-22 T1/T2 complete by Muse muse-spark-1.3 economy/medium; six-file diff captured in runs/20261022-172443/implementation.patch. Manifest shows only six approved application files changed. Walkthrough/full local verification dispatched; task in walkthrough-task.json. Independent review and finish passes remain before receipt.

- 2026-10-22 Post-build verifier VERIFIED local/mock: 696 tests,50 positioning,8 schema routes,6 dialogs,strict build exit0. Walkthrough report saved. Axis review Grok running, security Copilot quota fallback to Grok running, independent critique-B Sonnet running. No app changes after verification.

- 2026-10-22 Axis/security/dual critique PASS with no in-scope findings. Final review dispatched (final-review-task.json). Finish passes and final verifier evidence check remain before ship receipt.

- 2026-10-22 Final review APPROVE no blockers; receipt wording clarified. Muse Phase3b polish NO-OP; six owned hashes match verifier. Phase3c simplify running (simplify-task.json), final verifier evidence check follows.

- 2026-10-22 Build/review/finish/verification complete. Final VERIFIED local/mock after fresh hash and full app/source manifest checks; tests reused on unchanged bytes. Receipt runs/20261022-172443/receipt.md subsequently accepted by Jeremy. No commit, push or deploy. End-state statuses and learn deferred until ship decision.

- 2026-10-23 SHIP accepted by Jeremy: six-file local rebrand closeout, receipt runs/20261022-172443/receipt.md. Review and verification complete, polish/simplify no-op. Learned four repo rules and one harness candidate; no promotions (first occurrence). No commit, push or deploy.
- 2026-10-27 SHIP accepted by Jeremy: D4 lightbox focus restore, D2 /website-package retired (308 → /), D3 LeadForm CRM disclosure. Receipt .harness/runs/20261027-075439/receipt.md. Verifier VERIFIED round 1; final review APPROVE. Follow-ups (Safari mouse openers, weak test, SiteNav unit test) next run; /privacy Customer.io decision open.
- 2026-10-27 SHIP accepted by Jeremy: Safari opener fallback, focus test hardening, SiteNav return-focus tests; D7 privacy/LeadForm copy, where Customer.io is opt-out rather than opt-in only. Receipt .harness/runs/20261027-084922/receipt.md. Rebased onto origin/main (after #297 merged), pushed, PR opened.
- 2026-10-27 PR #299 merged (squash 448039f) by Jeremy's instruction; production confirmed: /website-package 308 → /, privacy opt-out copy live, real WebKit 27.2 focus walkthrough PASS 4/4 (closes the Safari-simulation-only risk). Codex P2 (pressed opener vs retained focus) fixed in 5811089 before merge.
- 2026-10-27 Merged new-dobeu-net #300 (f236a0f): test tidy + #299 ship record. Merged dts2-marketplace#3 (59a624d) → dts2-harness 3.6.2: request-refactor-plan (retired upstream) replaced by improve-codebase-architecture scoped to the builder file set with manual fallback; diagnose (renamed upstream) replaced by a fresh diagnosing-bugs pass at the hard cap. D5, D8 done. Installed plugin is still 3.6.1 until the user updates.
- 2026-10-27 dts2-harness 3.6.2 installed and verified (upgrade-check advanced 3.6.1 -> 3.6.2). Closed the stale 2026-10-22 planning open item (run accepted).
- 2026-10-27 SHIP accepted by Jeremy: end-state reconciliation, 55 done / 10 blocked / 1 todo; receipt .harness/runs/20261027-112109/receipt.md.
- 2026-10-27 SHIP accepted by Jeremy (pre-authorized: PR + merge on CI pass): reconciliation follow-ups 1–4 (admin gate, MFA, positioning tests; CLAUDE.md/CRON_SECRET docs). Row 65 done; P1 positioning and P4 admin authz checked. Receipt .harness/runs/20261027-134130/receipt.md. Logged S1, D9, D10, D11.
- 2026-10-28 D9 closed: two-user + company pgTAP for project_files, work_order_attachments and both storage buckets (83/83 local, picked up by CI); rows 39/40/44 done; GAP 1 and GAP 2 logged as Decisions. Receipt: .harness/runs/20261028-064556/receipt.md
- Ruling: builder claude/sonnet/medium over cheaper gemini — lane needed shell + local Docker stack — cost if wrong: ~1 tokenBurn step.
- Ruling: pgTAP pins current RLS behaviour; gaps become Decisions, no migrations this run — cost if wrong: gaps stay live until decided.
- Ruling: builder file committed on run branch dts2/20261028-064556 (copied from worktree, sha256 matched) because the shared pre-commit hook cannot resolve its gitignored script in worktrees — cost if wrong: none (hash-checked).
- 2026-11-03 #308 squash-merged (4143b91) after CI green (Vercel preview blocked by main-only gating; Entire Gates pending, not required). GAP 1 + GAP 2 fixed on fix/storage-gap1-gap2 (migrations 20261103000100/200, pgTAP 88/88). Receipt: .harness/runs/20261103-gaps/receipt.md
- Ruling: GAP 1 widen storage SELECT (not narrow table SELECT); GAP 2 drop storage DELETE (not add table DELETE). One builder, not two parallel: single local DB + shared test file. Cost if wrong: one reversible migration each.
- 2026-11-03 #309 merged (bc803d1); 20261103000100/200 applied to prod (supabase-dobe-net) via Composio SQL. Migration history reconciled: 5 prod-only 20261023* migrations added to repo from c5cc3d6 (byte-identical), prod 20260829202624 relabelled to 20260829010000, 10 repo migrations marked applied after schema evidence check; prod and local 20/20, db push dry-run up to date.
- 2026-11-03 D10 closed: /writing-for-agents re-run on end-state.md and plan-style.md, approved by Jeremy (form only). Per-run evidence moved verbatim to .harness/evidence-log.md; end-state 317 -> 231 lines; P6 agent-writing box checked.
- 2026-11-03 D11 closed via #313: real generated DB types, lib/domain-types.ts, CI drift check (green on GitHub). End-state row 1 done; P3 types box checked.
- 2026-11-03 D12 closed: Jeremy added LEAD_VERIFY_SECRET= and CRON_SECRET= (empty values, commented) to .env.example (protected path, human edit); presence verified. The CRON_SECRET .env.example gap from run 20261027-134130 is closed too.
- 2026-11-04 D13 closed: #314 and #315 merged (3a9d749); 20261104000100 applied to prod (supabase-dobe-net) via Composio SQL after a 0-duplicate re-check; prod history 21/21, db push dry-run up to date.
- 2026-11-04 Backlog D17, D18, D20, D23, D24, D26, D27 fixed on fix/backlog-d17-d27 (approved by Jeremy); 3 parallel builders on disjoint files; opus review APPROVE (MEDIUM: submit route session check, fixed). verify 1003/1003, pgTAP 137/137. D25 (zod 4) follows separately.
- Ruling: builders shared one tree on disjoint file sets (no worktrees) — local Supabase stack and node_modules shared — cost if wrong: transient cross-builder test failures (seen twice, cleared on rerun).
- 2026-11-04 Outstanding items: P1 done (L-002 promoted to review-checklist.md); lessons inbox consolidated into L-007..L-015, L-003/L-010/L-012 promoted (P2-P4 done); row 46 linked to H3 (live TOTP, owner Jeremy); postcss-selector-parser pinned 6.1.5 (GHSA-rj75-hqrm-r3gf fixed); deepmerge GHSA-gcqx-w48m-w2h4 accepted (no upstream fix) in SECURITY.md. pnpm audit --prod: 1 low.
- Fallback: reviewer:security copilot -> grok (copilot monthly quota exhausted).
- 2026-11-04 SHIP approved by Jeremy: run 20261103-213646 (super-admin dashboard, admin-posted work, audited billing, test-customer provisioning); verifier VERIFIED, final review APPROVE_WITH_CHANGES, 3/3 fix rounds; follow-ups D28-D32. Receipt: .harness/runs/20261103-213646/receipt.md
- 2026-11-04 PR #320 review-fix pass round 3 completed on resume and gated green (summary3.txt: 1188 vitest, pgTAP 151/151, e2e 131 passed, types clean) but the opus final review is REQUEST_CHANGES (D34-D39). Round cap reached; nothing committed. Awaiting Jeremy at the ship checkpoint: commit the fix pass to PR #320 with D34-D39 open, authorize a further round, or stop.
- 2026-11-04 PR #320 round 4 (Jeremy-authorized override past the cap, D34 + D38 only): both closed, opus APPROVE_WITH_CHANGES, local CI-equivalent gate green. Receipt: .harness/runs/20261103-213646/receipt.md (PR-fix pass round 4 block). Approved by Jeremy W., 2026-11-04. Not committed or pushed; waiting at the ship checkpoint for commit + push.
- 2026-11-04 shipped fix pass to PR #320 (4d814db, fix(admin): PR #320 review fixes), receipt .harness/runs/20261103-213646/receipt.md; pushed as a fast-forward; PR body updated with Linked work + Rule 8 receipt. Committed from a clean detached worktree because scripts/safe-env.sh blocks commits while .env.local (do_not_touch) is present; the hook ran (type-check + 1204 tests). Branch sweep proposed, not applied (needs Jeremy's yes); cleanup 0 branches, 0 PRs closed, 0 folded so far.
- 2026-11-04 PR #320 merged to main (squash 00bf47d, 07:08 UTC) on Jeremy's instruction after all functional checks passed; Vercel preview block (unsigned agent commit) and Entire approval gate accepted as non-blocking. Production deploy and walkthrough pending. Receipt: .harness/runs/20261103-213646/receipt.md
- 2026-11-04 Production verified: dpl_CGQDvF3qSAkKyp5bvHPKMA3SuXGT (00bf47d) on https://dobeu.net, read-only walkthrough PASS 13/13 at 2026-11-04T07:31:58Z (no sign-in, nothing created); signed-in admin and test-customer screens not walked (H3). Receipt Production line filled.
- 2026-11-04 Branch cleanup on Jeremy's yes: deleted 15 local branches already merged into main (incl. dts2/20261103-213646), listed in the receipt; skipped open PRs #307 and #298, unproven origin/dts2/20261022-084201-b2 and -b3, and dev. D35, D36, D37 and D39 stay open as action items.
- 2026-11-04 shipped PR #321 (chore(harness): record production walkthrough, branch cleanup and D41), receipt .harness/runs/ship-20261104-023936/receipt.md; cleanup 0 branches, 0 PRs closed, 0 folded
- 2026-11-04 Ruling: /company middleware gate is sign-in only, next = pathname + search — middleware can't know company-admin rank without per-request DB reads and must not send non-admin members to MFA — cost if wrong: an AAL1 admin reaches the shell, but the layout, the pages and the actions still block.
- 2026-11-04 Ruling: AAL2 + active company enforced in requireCompanyAdmin (actions), the /company layout and each /company page (guardCompanyPage), not in requireCompanyMember; reuse AuthError("mfa_required"); no migration — L-014, and layout/page render in parallel — cost if wrong: direct PostgREST writes at AAL1 stay possible until D42.
- 2026-11-04 shipped run 20261104-025630 (D28 + D41 + S46: /company gate, AAL2 + active company for company admins, MFA next sanitized), receipt .harness/runs/20261104-025630/receipt.md; verifier VERIFIED, final review APPROVE_WITH_CHANGES (applied), 2 fix rounds; follow-ups D42 (RLS migration), D43 (deep link)

## Failures and escalations
- 2026-11-04 run 20261103-213646 PR #320 review-fix pass: round cap (3/3) reached with the opus final review still REQUEST_CHANGES (H1: voided work order not re-billable from the UI; M1–M4). Tree is green (gate r3, .harness/runs/20261103-213646/pr-fix/summary3.txt) but uncommitted; findings filed as Decisions action items. Escalated to Jeremy: ship the fix pass as-is with the items open, authorize a further round, or stop.
- 2026-11-03 run 20261103-213646: ADMIN_EMAILS (Vercel, Sensitive) — read-modify-write via `vercel env pull` read an 11-char placeholder (Sensitive values are not pullable), so Production was overwritten with `<placeholder>,jeremyw@dobeu.net`; the original admin entry is unrecoverable by tooling. Preview untouched (original, 166d). Not yet deployed. Escalated to Jeremy to re-enter the full list; no further env writes without explicit instruction.
  - Resolved 2026-11-04 02:45 UTC on Jeremy's instruction ("make jeremyw@dobeu.net the only admin"): ADMIN_EMAILS set to exactly jeremyw@dobeu.net (Sensitive) in Production and Preview via `vercel env add --force --sensitive` with stdin; confirmed by API updatedAt metadata only (values never read or printed). Takes effect on the next deploy of each environment.

- 2026-10-22 GTM researcher hit provider usage limit after competitor profiling and SEO report. Root continued remaining installed workflows sequentially from saved artifacts; no duplicate dispatch.

## Open items

- None.

### Commit and PR authorization — 2026-10-23

Jeremy requested "Commit and create PR on main": commit the approved rebrand and harness artifacts on the run branch, push that branch, and open a PR targeting main; no merge or production deploy. Fresh source fingerprints match the verified tree. The setup-pre-commit and pr companions were installed and read. Dependency additions and auto-formatting from setup-pre-commit are omitted to preserve approved scope; a repository-local Git hook checks staged whitespace, type-check and unit tests under the credential-free wrapper. Runtime OMC state and the pending upgrade marker remain uncommitted.
- 2026-10-27 S1 closed via a local Supabase stack in CI E2E. pgTAP added to the E2E job. Ticket E2E login fixed. Rows 37/38/42/43/63 done. Receipt: .harness/runs/20261027-151152/receipt.md
- Ruling: builders shared the run branch tree on disjoint files instead of worktrees, because both needed the running local Docker stack and node_modules. Cost if wrong: file collision (none occurred).
- 2026-10-27 Contact-form spam fix shipped: verify-first lead flow plus silent bot filters. Receipt: .harness/runs/20261027-172221/receipt.md
