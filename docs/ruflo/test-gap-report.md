# new-dobeu-net — Test Gap Report

**Generated:** 2026-07-24 by ruflo swarm team (testgap-researcher + testgap-tester, swarm hierarchical/specialized)
**Scope:** main tree only (`.worktrees\` excluded). Test stack: vitest (unit), Playwright (e2e), Testing Library installed.
**Baseline:** 38 unit test files + 2 e2e specs. Coverage of `lib/` is strong (26/30 modules tested). Gaps below are the exceptions.

## High-priority gaps

1. **`app/api/agent/route.ts` — no `route.test.ts`.** Every other non-trivial API route (cron, lead, github-repo, typeform/webhook, webhooks/calendly, webhooks/stripe, files/[id]/download, auth/callback) has a colocated test; the AI agent endpoint does not. This route accepts external input and drives `lib/agent` — it needs tests for auth/authorization, input validation, and error paths at minimum.
2. **`lib/invoice-creation.ts` — untested.** Billing-adjacent logic with zero unit tests, while its neighbors (`stripe.ts`, `stripe-event-dedupe.ts`, `lib/actions/invoices.ts`) are all tested. Money paths deserve the same treatment.
3. **`app/api/github-activity/route.ts` — untested.** Its sibling `github-repo/route.ts` has tests; this one has none. External API dependency (GitHub) makes it a natural place for mocked failure-mode tests (rate limits, timeouts).
4. **`lib/supabase/server.ts` — untested.** `client.ts` and `middleware.ts` both have tests; the server-side client factory does not, and it's the one used by privileged code paths.
5. **`app/api/intercom/jwt/route.ts` — untested route wrapper.** The underlying `lib/intercom-jwt.ts` is tested, but the route (which decides *who* gets a signed JWT) is not — the authorization boundary is exactly the part without coverage.

## Medium-priority gaps

6. **`components/` — 48 `.tsx` components, zero component tests.** Testing Library (`@testing-library/react` + `jest-dom`) is installed but unused. Recommend starting with the components that carry logic (forms, portal widgets) rather than presentational ones.
7. **`hooks/use-motion-props.ts` — untested** (its sibling `use-cookie-consent.ts` is tested).
8. **E2E breadth:** only `smoke.spec.ts` and `tickets.spec.ts`. The revenue-relevant funnels — lead capture (`/api/lead` + form), auth flow, and portal invoices/files — have no end-to-end coverage.

## Low priority

9. **`lib/jeremy-data.ts`** — untested; appears to be static data, test only if it gains logic.

## Suggested next actions (in order)

`route.test.ts` for `app/api/agent` → `invoice-creation.test.ts` → `github-activity` route test → `supabase/server.test.ts` → one e2e spec for the lead-capture funnel. The repo's `pnpm verify` gate (type-check + lint + test:ci + strict build) will pick these up automatically once written — no CI changes needed.

---
*Stored in hub memory as `repo/new-dobeu-net/testgap-2026-07-24` (namespace `swarm/testgap`). Re-run: spawn researcher+tester per `docs\superpowers\plans\2026-07-24-ruflo-harness-rollout.md` Task 6.*
