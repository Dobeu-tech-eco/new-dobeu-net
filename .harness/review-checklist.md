# Review Checklist — new-dobeu-net

## Correctness
- [ ] Logic matches the stated intent of the change
- [ ] Edge cases handled (empty arrays, null/undefined, missing env vars)
- [ ] Server Actions return discriminated `{ ok, data } | { ok, error }` — never throw to the client
- [ ] `"use server"` modules never export non-action helpers (transitive client exposure)
- [ ] RLS implications considered — admin reads use `createAdminClient()`, user reads use `createClient()`
- [ ] No accidental static rendering on routes that read cookies/auth (`export const dynamic = "force-dynamic"`)

## Types
- [ ] No `any` introduced without justification
- [ ] `pnpm type-check` passes
- [ ] `lib/database.types.ts` not hand-edited — regenerated with `pnpm db:types` if schema changed

## Tests
- [ ] New behavior has a test; changed behavior has an updated test
- [ ] `lib/actions/*.test.ts` uses `buildStubClient()` from `__test-helpers.ts`
- [ ] `pnpm test:ci` passes
- [ ] E2E smoke (`pnpm test:e2e`) not broken

## Security
- [ ] API inputs validated with Zod
- [ ] No `dangerouslySetInnerHTML` on user-controlled content
- [ ] Auth checks present: `requireUser()` / `requireAdmin()` on every protected route
- [ ] CSP arrays in `next.config.ts` updated if adding new third-party origins
- [ ] `middleware.ts` matcher updated if adding new top-level bypass paths
- [ ] No secrets in client-exposed `NEXT_PUBLIC_*` vars
- [ ] Rate limiting on new public POST endpoints

## Conventions
- [ ] Conventional Commits format: `<type>(<scope>): <summary>`
- [ ] Path alias `@/*` used consistently
- [ ] Immutability in `lib/*` — never mutate inputs
- [ ] Heavy embeds lazy-loaded via `next/dynamic`
- [ ] No `next.config.js` added (shadows the `.ts` file)
- [ ] `runtime = "edge"` only where genuinely needed (not static metadata routes)

## Evidence
- [ ] Test results reused after a review or polish pass are tied to the same app/source manifest and owned-file sha256s; re-run when either changed (L-002)

## Process
- [ ] Dialog changes keep close behaviour and focus restoration as separate concerns; preexisting accessibility findings are reported, not silently fixed in a copy-only change (L-003)
- [ ] A branch whose base was squash-merged is rebased with `git rebase --onto origin/main <old-base>` before pushing (L-010)
- [ ] Closing a documented gap, adding a classification list, or changing a mechanism the docs name (e.g. a validator moved to a new helper) re-checks CLAUDE.md, SECURITY.md, docs/security/, docs/DEPLOYMENT.md and .harness/ for the old name and for sentences it contradicts, in the same commit (L-012)
- [ ] Every builder worktree got a real pinned `pnpm install --frozen-lockfile --offline` from the lead before dispatch (`node_modules/next/package.json` present, `node_modules` not a symlink); a symlinked node_modules passes tsc/eslint/vitest but breaks `next build` (L-027)

## Scope
- [ ] PR is focused — no unrelated cleanup bundled
- [ ] No features/abstractions beyond what the task requires
