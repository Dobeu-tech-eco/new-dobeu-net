---
name: homepage-critique-fix
description: Run the dual-agent homepage critique-to-fix loop on dobeu.net without breaking price-band honesty or the live logo
triggers:
  - homepage critique fixes
  - price-band promise mismatch
  - impeccable critique follow-up on dobeu.net
  - SubBrandsStrip placement
  - scroll lamp striping text
---

## Inputs

- Target surface: `app/page.tsx` plus `components/landing/*`, `lib/jeremy-data.ts`, `e2e/smoke.spec.ts`.
- `PRODUCT.md` constraints (never re-derive): Send the job = price-band reply, never an instant quote; `$5k–$30k` band stays published; case-study metrics stay unpublished until `approved === true`; dead hosts never appear; live logo in `components/brand/DobeuMark.tsx` is never redrawn.
- Latest critique snapshot in `.impeccable/critique/` with P0–P3 issues and suggested commands.

## Steps

1. Load context: `sh .cursor/skills/impeccable/scripts/impeccable context --target app/page.tsx`. If the launcher fails, announce it and read `PRODUCT.md` plus the target files directly.
2. Resolve the critique slug before assessing: `sh .cursor/skills/impeccable/scripts/impeccable critique-storage slug "app/page.tsx"`.
3. Fan out Assessment A (design review) and Assessment B (detector + browser evidence) as two isolated parallel subagents with no shared output. A finishes before detector output enters synthesis. If no subagent tool exists, emit the `DEGRADED: single-context` banner.
4. Assessment B runs `sh .cursor/skills/impeccable/scripts/impeccable detect --json <target>` (exit 0 clean, 2 findings) and browser visualization on a fresh tab via localhost URL. Never claim overlays exist unless injection succeeded.
5. Synthesize one combined report in chat: provenance line, heuristic table with applicable maximum, specificity verdict, 3–5 prioritized issues with P-level + fix + suggested command, persona red flags (Jordan, Riley, Casey), minor notes, provocative questions. Persist the snapshot with `IMPECCABLE_CRITIQUE_META` JSON, print the trend line, then ask 2–4 targeted questions with concrete options.
6. Implement approved scope with file-scoped parallel workers (disjoint allow-lists, no commits from workers). Keep CTA presentation (Hero, StickyMobileCTA, FinalCTA, EstimateCtas) in one worker to avoid wiring collisions. Keep Services, detector nits, and spec updates in separate workers.
7. Integrate, then verify: `pnpm type-check`, `pnpm test:ci`, ESLint on changed TS files, browser at 390x844 and 1440x900 (cookie bar clear of hero, dialogs match entry, sticky bar both actions, proof links resolve, lamp transform `none`), one test lead submit.
8. Commit on a stacked `cursor_dev/<name>-50c0` branch, push with `git push -u origin <branch>`, attempt PR via ManagePullRequest (base = parent branch). If the forge rejects for permissions, report the compare URL instead of retrying via CLI.

## Success criteria

- Every shipped Priority issue maps to a visible change or a written accept-with-reason.
- `type-check`, `test:ci`, and ESLint on changed files all green.
- Phone and desktop screenshots show CTAs reachable, dialogs honest, proof checkable.
- Logo file untouched; price-band wording identical everywhere the pair appears.

## Pitfalls

- Subagents share one workspace: overlapping allow-lists cause silent overwrites. Assign disjoint files; integrate shared wiring yourself.
- `detect` on TSX is regex-only; empty means nothing about the rendered page. Always pair with served-HTML scan plus browser snapshot.
- Detector flags intentional voice (`No theater`, rebuttal cadence) and the aria-labeled availability dot. Fix only what preserves meaning; record accepts.
- `LeadForm` success copy must read as job intake, not newsletter. Submit verb must match the entry CTA.
- Untracked `*.png` and `.playwright-mcp/` noise accumulates; never commit it.
- PR creation fails when the token is not a collaborator. One attempt via the PR tool, then hand over the compare link.

## Verification evidence

- Critique snapshot path plus trend line in chat.
- Test counts (`test:ci` totals), lint result, browser measurements (banner/CTA overlap booleans, lamp transform, link counts).
- Phone + desktop screenshots referenced from `/opt/cursor/artifacts/`.
- Branch name, commit SHA, push result, PR URL or compare link.
