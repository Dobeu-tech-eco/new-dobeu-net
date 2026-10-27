# Harness state

Append entries as `- <date> <text>`.

## Decisions
- 2026-10-27 PR #299 merged (squash 448039f) by Jeremy's instruction; production confirmed: /website-package 308 → /, privacy opt-out copy live, real WebKit 27.2 focus walkthrough PASS 4/4 (closes the Safari-simulation-only risk). Codex P2 (pressed opener vs retained focus) fixed in 5811089 before merge.
- 2026-10-27 SHIP accepted by Jeremy: Safari opener fallback, focus test hardening, SiteNav return-focus tests; D7 privacy/LeadForm copy, where Customer.io is opt-out rather than opt-in only. Receipt .harness/runs/20261027-084922/receipt.md. Rebased onto origin/main (after #297 merged), pushed, PR opened.
- 2026-10-27 SHIP accepted by Jeremy: D4 lightbox focus restore, D2 /website-package retired (308 → /), D3 LeadForm CRM disclosure. Receipt .harness/runs/20261027-075439/receipt.md. Verifier VERIFIED round 1; final review APPROVE. Follow-ups (Safari mouse openers, weak test, SiteNav unit test) next run; /privacy Customer.io decision open.

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

## Failures and escalations

- 2026-10-22 GTM researcher hit provider usage limit after competitor profiling and SEO report. Root continued remaining installed workflows sequentially from saved artifacts; no duplicate dispatch.

## Open items

- 2026-10-22 Lead planning result recovered in full to runs/20261022-172443/plan-draft-r1.md. It is a draft, not approved. Revision round 2 completed; verbatim result saved to runs/20261022-172443/plan-draft-r2.md. Run completed and accepted; see shipped receipt. Batch count clarification: 11 selected sections (6 verification-only and 5 changes); S24 is an additional deferred section, not included in the 11. No builders started. Preserve all existing rebrand approvals and dirty baseline.

### Commit and PR authorization — 2026-10-23

Jeremy requested "Commit and create PR on main": commit the approved rebrand and harness artifacts on the run branch, push that branch, and open a PR targeting main; no merge or production deploy. Fresh source fingerprints match the verified tree. The setup-pre-commit and pr companions were installed and read. Dependency additions and auto-formatting from setup-pre-commit are omitted to preserve approved scope; a repository-local Git hook checks staged whitespace, type-check and unit tests under the credential-free wrapper. Runtime OMC state and the pending upgrade marker remain uncommitted.
