# Checkpoint Protocol — dobeu.net

> Run this gate at the end of every numbered Step (1–6).
> A step is NOT complete until all checks below pass.
> Commit the checkpoint result to the feature branch with tag `[checkpoint-N]`.

---

## How to Run

```bash
# From repo root — run all gates in sequence
pnpm type-check      # must be 0 errors
pnpm lint            # must be 0 errors, 0 warnings
pnpm test:ci         # must be all passing
pnpm build           # must produce a clean production build
```

Or run the combined shortcut (mirrors CI exactly):
```bash
pnpm verify
```

---

## Full Checkpoint Checklist

### 1. TypeScript
- [ ] `pnpm type-check` — 0 errors
- [ ] No `any` types introduced without a `// REASON:` justification comment
- [ ] No `@ts-ignore` without a justification comment

### 2. ESLint
- [ ] `pnpm lint` — 0 errors, 0 warnings
- [ ] No `dangerouslySetInnerHTML` on static string content (must use JSX entities)
- [ ] No `console.log("[v0]...")` debug statements remaining

### 3. Tests
- [ ] `pnpm test:ci` — all tests pass
- [ ] No tests skipped with `.skip` or `.only` left in production code
- [ ] If new behavior was added, new tests cover it

### 4. Build
- [ ] `pnpm build` — clean with no errors
- [ ] `scripts/strict-build.mjs` passes (no `Detected "engines"` or static generation warnings)
- [ ] Bundle size has not regressed significantly (check `.next/analyze/` if bundle analysis was run)

### 5. Dead Code Scan
- [ ] Remove all unused imports surfaced by ESLint
- [ ] Remove all commented-out code blocks (unless tagged `// TODO:` or `// PHASE N:`)
- [ ] Remove any `_tmp_*` scratch files from root
- [ ] Run `pnpm dlx knip` if significant refactoring occurred — verify no new orphans

### 6. Security Scan
- [ ] No hardcoded secrets, API keys, or credentials in any committed file
- [ ] No `dangerouslySetInnerHTML` without `// SECURITY: justification` comment
- [ ] No new `'unsafe-inline'` or `'unsafe-eval'` added to CSP in `next.config.ts`
- [ ] No in-memory rate limiting introduced — use `@upstash/ratelimit`
- [ ] No unvalidated redirect params (check any `searchParams.get("next")` usage)
- [ ] Dependabot alerts reviewed: `gh api repos/Dobeu-tech-eco/dobeu-net/vulnerability-alerts`

### 7. Git Hygiene
- [ ] `git fetch origin && git status` — no untracked files that should be committed
- [ ] No merge conflicts remaining
- [ ] Feature branch is not behind `dev` by more than 5 commits (rebase if so)
- [ ] Branch name follows convention: `feature/*`, `fix/*`, or `step-N-*`

### 8. Performance (Step 2+ only)
- [ ] Run `agent-browser vitals http://localhost:3000 --json` on local build
- [ ] LCP ≤ 2.5s on mobile emulation
- [ ] CLS ≤ 0.1
- [ ] No new `initial={{ opacity: 0 }}` on above-fold elements

### 9. Accessibility (Step 4+ only)
- [ ] Run axe-core or `agent-browser` axe audit — 0 Level A violations, 0 Level AA violations
- [ ] Skip-to-main-content link is present and focusable
- [ ] All dialogs have `aria-modal="true"` and focus trap
- [ ] Focus rings visible at full opacity (not `outline-ring/50`)

### 10. Commit
```bash
git add -A
git commit -m "type(scope): description

- bullet: what changed
- bullet: why

[checkpoint-N] ✓ lint ✓ tsc ✓ tests ✓ build ✓ security

Co-authored-by: v0agent <it+v0agent@vercel.com>"
git push origin <feature-branch>
```

---

## Checkpoint Results Log

Record each checkpoint result here so the next agent has a clear history.

| Date | Agent | Step | lint | tsc | tests | build | security | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-06-20 | v0 | infra | N/A | N/A | N/A | N/A | N/A | Agent config files only — no app code changed |

---

## Quality Gates (must pass before dev → main PR)

| Gate | Target | Tool |
|---|---|---|
| Lighthouse Performance (mobile) | ≥ 90 | Lighthouse CI / `agent-browser vitals` |
| Lighthouse Accessibility | ≥ 95 | Lighthouse CI |
| Lighthouse SEO | 100 | Lighthouse CI |
| Lighthouse Best Practices | ≥ 95 | Lighthouse CI |
| axe-core violations (Level A) | 0 | `agent-browser` + axe |
| axe-core violations (Level AA) | 0 | `agent-browser` + axe |
| TypeScript errors | 0 | `pnpm type-check` |
| ESLint errors | 0 | `pnpm lint` |
| Test failures | 0 | `pnpm test:ci` |
| Build errors | 0 | `pnpm build` |
| Mobile LCP | ≤ 2.5s | `agent-browser vitals` |
| CLS | ≤ 0.1 | `agent-browser vitals` |

---

## Failure Handling

If any gate fails:
1. Do **not** mark the Step as complete
2. Fix the failing check
3. Re-run from top of this checklist
4. Append failure note to `.agent/HANDOFF.md` so the next agent knows what was attempted
5. Only commit once all gates are green

If a gate is intentionally deferred (e.g. Lighthouse pending performance work):
- Add a `// DEFERRED: reason — target Step N` comment in the relevant file
- Record the deferral in `.agent/HANDOFF.md`
- Do **not** skip silently
