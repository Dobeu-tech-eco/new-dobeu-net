# Lessons

Each entry: `- [L-NNN] <rule> (source: <run or PR>)`

- [L-001] Compare changes against the saved dirty baseline, preserving unrelated edits; keep backup source copies suffixed .baseline so Vitest and TypeScript do not discover them. (seen 1x, last 2026-10-23, source: run 20261022-172443)
- [L-002] Verify the full app/source manifest and owned-file hashes before reusing test results after a no-op review or polish pass. (seen 2x, last 2026-10-28, source: run 20261022-172443, run 20261028-064556; lives at .harness/review-checklist.md)
- [L-003] Separate dialog-close behavior from focus restoration and report preexisting accessibility findings without silently expanding a copy-only change. (seen 2x, last 2026-10-27, source: run 20261022-172443, run 20261027-075439; lives at .harness/review-checklist.md)
- [L-004] Record provider fallback and reduced review independence in the receipt, including explicit execution-model identity and skipped automatic rule loading. (seen 1x, last 2026-10-23, source: run 20261022-172443)
- [L-005] Set set_config('storage.allow_delete_query','true',true) before any pgTAP DELETE on storage.objects so storage.protect_delete() does not mask RLS, and keep a cross-user is_empty delete plus a post-reset row inventory so the flag cannot turn a denial into a pass. (seen 1x, last 2026-10-28, source: run 20261028-064556)
- [L-006] Cast pg_policies name columns with ::text collate "default" before comparing them in pgTAP results_eq. (seen 1x, last 2026-10-28, source: run 20261028-064556)
- [L-007] Restore focus for a programmatically opened Radix Dialog through onCloseAutoFocus with an opener captured at open time; pass a stable return target when the opener sits in transient UI (dropdown item, mobile drawer), ignore document.activeElement when it is <body>, and clear the stored opener after use. (seen 1x, last 2026-10-27, source: run 20261027-075439)
- [L-008] Assert focus against the intended landing element, never with not.toBe(<removed node>), which always passes. (seen 1x, last 2026-10-27, source: run 20261027-075439)
- [L-009] Delete .next/dev after removing an app route; stale .next/dev/types fail the next local type-check. (seen 1x, last 2026-10-27, source: run 20261027-075439)
- [L-010] Rebase a branch with `git rebase --onto origin/main <old-base>` after its base branch is squash-merged, so the duplicated commits drop before pushing. (seen 2x, last 2026-11-04, source: run 20261027-075439, D25 zod branch on #317; lives at .harness/review-checklist.md)
- [L-011] Give section rows that share a blocker the same status; an RLS-only page stays blocked while the RLS row is blocked, and a two-part acceptance box stays unchecked until both parts have evidence. (seen 1x, last 2026-10-27, source: run 20261027-112109)
- [L-012] Re-check blanket summary sentences after adding a classification list or closing a documented gap; grep SECURITY.md, docs/security/, docs/DEPLOYMENT.md and .harness/ in the same change. (seen 2x, last 2026-11-03, source: run 20261027-112109, run 20261103-gaps; lives at .harness/review-checklist.md)
- [L-013] Give a text-scraping guard test a self-test for every syntactic form it claims to cover, or scan the whole source with comments stripped. (seen 1x, last 2026-10-27, source: run 20261027-134130)
- [L-014] Enforce an auth-changing rule in the POST handler as well as the page that hides the button; a page rendered before the rule existed still submits. (seen 1x, last 2026-11-04, source: backlog D27 review)
- [L-015] Gate primary tables and empty states on the primary read only; an auxiliary picker or badge lookup failure gets a non-blocking notice. (seen 1x, last 2026-11-03, source: #311 Codex/Bugbot review)
