# Lessons

Each entry: `- [L-NNN] <rule> (source: <run or PR>)`

- [L-001] Compare changes against the saved dirty baseline, preserving unrelated edits; keep backup source copies suffixed .baseline so Vitest and TypeScript do not discover them. (seen 1x, last 2026-10-23, source: run 20261022-172443)
- [L-002] Verify the full app/source manifest and owned-file hashes before reusing test results after a no-op review or polish pass. (seen 2x, last 2026-10-28, source: run 20261022-172443, run 20261028-064556)
- [L-003] Separate dialog-close behavior from focus restoration and report preexisting accessibility findings without silently expanding a copy-only change. (seen 1x, last 2026-10-23, source: run 20261022-172443)
- [L-004] Record provider fallback and reduced review independence in the receipt, including explicit execution-model identity and skipped automatic rule loading. (seen 1x, last 2026-10-23, source: run 20261022-172443)
- [L-005] Set set_config('storage.allow_delete_query','true',true) before any pgTAP DELETE on storage.objects so storage.protect_delete() does not mask RLS, and keep a cross-user is_empty delete plus a post-reset row inventory so the flag cannot turn a denial into a pass. (seen 1x, last 2026-10-28, source: run 20261028-064556)
- [L-006] Cast pg_policies name columns with ::text collate "default" before comparing them in pgTAP results_eq. (seen 1x, last 2026-10-28, source: run 20261028-064556)
