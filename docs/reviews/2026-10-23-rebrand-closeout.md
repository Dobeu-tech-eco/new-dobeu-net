# Rebrand closeout evidence

This receipt records the bounded closeout against the already-approved rebrand working tree. The PR also includes that earlier rebrand baseline. Commit and PR creation were subsequently authorized on 2026-10-23. Run artifacts referenced below remain local under `.harness/runs/20261022-172443/`.

## Change receipt

### Scope

Four identity pages no longer emit ProfessionalService JSON-LD: /, /about, /case-studies, /process. /services and other schemas remain unchanged. LeadForm now shows Company (optional) and you@example.com, with assertions in both existing tests. Only six approved source/test files changed against the saved dirty baseline.

### Tests run

| Check | Pass | Fail | Skip |
|---|---|---|---|
| pnpm verify: Vitest (67 files) | 696 | 0 | 0 |
| Positioning: Chromium + mobile Chrome | 50 | 0 | 0 |
| Rendered JSON-LD routes | 8 | 0 | 0 |
| Dialog walkthroughs | 6 | 0 | 0 |

Type-check PASS; lint PASS with 0 errors and 7 preexisting warnings; strict build PASS. Final hash check: 6/6; whole manifest: 764 baseline paths, no unrelated app/source changes, no protected-path changes. Coverage: page changes exercised by route e2e and rendered-schema capture; LeadForm by unit tests and dialog checks. Evidence: walkthrough.md, final-verification.md and their logs. Local Node26; Node24 CI not run.

### Review verdict

Axis and security reviews PASS. Final review APPROVE with no blockers. Phase 3b polish NO-OP; Phase 3c simplify: no fixes, optimize: n/a. Final verifier VERIFIED (local/mock only). Results reused after fresh six-file hash and full app/source manifest checks; tests were not rerun after the no-op finish passes. See final-verification.md.

### Delegation

Models:
- gemini gemini-3.8-flash-low effort=medium (execution; no output, no changes)
- muse muse-spark-1.3 effort=medium (execution)
- grok grok-4.7 effort=medium (advisory; profile model, no separate CLI effort flag)
- copilot profile-default effort=medium (advisory; quota failure, replaced by Grok)
- claude claude-sonnet-5-5 effort=medium (advisory)
- claude claude-opus-5-5 effort=medium (signoff: V0 baseline verifier, post-build walkthrough verifier, final reviewer, final evidence verifier; separate tasks)

Delegation policy: OK

Gemini exited 0 but produced no patch; artifact validation rejected it. Copilot was skipped for execution because its profile did not pin a model, then hit quota in its advisory security seat. Grok covered both general-axis review and security fallback, reducing provider independence; separate Sonnet visual assessment and Opus final review remained. Muse initially skipped automatic project-rule loading in its untrusted workspace; its brief named the rules, and independent reviews confirmed scope and behavior. The finish brief includes explicit rules.

### Approved by

Jeremy W., 2026-10-23 — explicit Ship approval in this conversation; local acceptance only.

### Steps outside this change

Website-package offer and form/privacy disclosure decisions deferred. No live integrations, real form submissions or production verification. No commits, pushes, deployment.

### Findings and lessons

No CRITICAL, HIGH or MEDIUM in-scope findings. LOW review notes: duplicate assertions retained as harmless per independent simplification review; redundant Optional placeholder preserved per approved scope. Receipt records provider fallback and model-role limitations.

Lesson candidates for after-ship learning: require a nonempty builder artifact even with exit 0; include explicit repository rules when automatic loading is skipped; use .baseline suffixes outside test discovery; record when a quota fallback reduces review independence; reuse test evidence only after byte-identity verification.

### Open risks

Preexisting focus restoration to body on dialog close; seven lint warnings; local Node26 vs CI Node24. Booking fallback tested, external Calendly untested. Missing request-refactor-plan companion, manual scoped simplification used. Baseline source copies renamed .baseline to avoid test discovery.

### Rollback point

d006cc06d0441bb7feaf4b7fd10d0adfecc166dd. Preserve preexisting dirty edits; revert only implementation.patch using byte backups under baseline/owned if requested.

### Production

- Production: not deployed yet

## PR review follow-up

PR #296 review identified three valid issues: retired case-study URLs, the renamed service URL, and a stale visible terms revision date. Permanent redirects now retain all six retired case-study URLs via the case-study index and map `/services/ai-agents` to `/services/business-systems`. Terms reads `CONTENT_DATES.terms`. The duplicate service-redirect finding is addressed by the same fix.

Validation: fresh `pnpm verify` passed (696 tests, type-check, lint with seven existing warnings, strict build). `e2e/rebrand-redirects.spec.ts` passed 16/16 across Chromium and mobile Chrome, checking 308 responses, query preservation, destination availability, and terms date metadata. Credentials were stripped using the existing safe-environment wrapper. GitHub checks on the new commit must pass before merge.

## Contact and FAQ route repair

User-reported Contact and FAQ errors were reproduced as HTTP 404 at `/contact` and `/faq`; neither App Router page existed. FAQ navigation also targeted an absent homepage anchor. Added pages using the existing marketing shell, collaboration form and FAQ accordion, connected navigation and sitemap entries, and retained the existing submission/consent behavior. No live form submission was made.

Validation: `pnpm verify` passed (696 tests; seven preexisting lint warnings; strict build), and the positioning plus Contact/FAQ browser suites passed 58/58 on desktop and mobile Chrome. Both new routes return successful page responses, footer links navigate, the form is available, and FAQ answers expand/collapse.
