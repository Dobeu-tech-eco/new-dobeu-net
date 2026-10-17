# Production Hardening Gap Analysis

_Generated: 2026-10-17 against main HEAD `1dc0f7c`_

## PLAN.md Part 2 — Critical Fixes Status

| # | Task | Status | Evidence |
|---|---|---|---|
| 1 | Unblock CSP — single Next config | **DONE** | `next.config.js` removed; only `next.config.ts` exists (PR #181) |
| 2 | Production env correctness | **PARTIAL** | `.env.example` updated (legacy `NEXT_PUBLIC_SUPABASE_*` removed). Vercel env completeness needs operator verification |
| 3 | SSRF/traversal fix (PR #178) | **DONE** | Fixed independently via PR #182; `parseGitHubRepo` has strict regex + `..` rejection |
| 4 | Supabase RLS hygiene | **DONE** | `20260717053750_profiles_update_with_check.sql` + `20260717064702_rls_hardening_wo_and_anon_insert.sql` |
| 5 | GitHub security baseline | **NOT DONE** | Secret scanning: disabled. Push protection: disabled. Only Dependabot security updates enabled |
| 6 | Docs + `.env.example` alignment | **DONE** | Legacy env names removed from `.env.example` |

## Open Decisions (from PLAN.md)

| # | Decision | Current State |
|---|---|---|
| 1 | SMS MFA scope (admin-only / all users / deferred) | Still open — no Twilio code exists |
| 2 | Node version policy (20 vs 24) | **Resolved** — `>=24` in `engines`, `.nvmrc = 24` |
| 3 | CodeQL / CodeRabbit on repo | Still open — neither configured |

## Remaining Gaps (Prioritized)

### HIGH — Security

1. **Enable GitHub secret scanning + push protection**
   - `secret_scanning: disabled`, `secret_scanning_push_protection: disabled`
   - Action: `gh api repos/Dobeu-tech-eco/new-dobeu-net -X PATCH -f security_and_analysis.secret_scanning.status=enabled -f security_and_analysis.secret_scanning_push_protection.status=enabled`
   - Blocked on: repo admin access

2. **Verify production env vars are set on Vercel**
   - Missing (per July audit): `UPSTASH_REDIS_REST_URL/TOKEN`, `CALENDLY_WEBHOOK_SIGNING_KEY`, `TYPEFORM_WEBHOOK_SECRET`, `CUSTOMERIO_SITE_ID/API_KEY`, `GITHUB_TOKEN`
   - Action: `vercel env ls` to confirm current state
   - Impact: Rate limiting falls back to in-memory (per-instance); Calendly webhook returns 503; Customer.io events drop silently

3. **Datadog env tag correctness**
   - PLAN.md flagged `NEXT_PUBLIC_DATADOG_ENV=development` on Production/Preview
   - Action: Verify/fix via Vercel dashboard

### MEDIUM — Verification Gate

4. **Live header verification**
   - `curl -sI https://dobeu.net` should show CSP, HSTS, X-Frame-Options, Permissions-Policy
   - Last verified: PLAN.md says CSP was unshipped (pre-Task 1 fix); needs re-verification post-fix

5. **Stripe webhook endpoint verification**
   - Subscribed events: `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `invoice.voided`
   - Signing secret matches `STRIPE_WEBHOOK_SECRET`

6. **Calendly → lead pipeline end-to-end test**
   - A test booking should produce a `leads` row + notification email
   - Blocked on: `CALENDLY_WEBHOOK_SIGNING_KEY` being set

### LOW — Deferred

7. **SMS MFA decision** — Twilio Verify as secondary factor; admin-only vs all users
8. **CodeQL / code scanning** — GitHub Advanced Security or free CodeQL
9. **Mobile Lighthouse Performance** — currently ~80 (target 90); non-gating
10. **Post-launch automations** — daily lead digest, weekly Lighthouse, monthly invoice aging (Phase 6, never built)

## Agent Plans Found

| Source | Location | Content |
|---|---|---|
| PLAN.md Part 2 | `PLAN.md` (lines 29-88) | Production hardening sprint — 6 critical fixes + verification gate |
| PLAN.md Part 3 | `PLAN.md` (lines 69-74) | Deferred: Twilio SMS, landing conversion pack, automations, v2 backlog |
| Production Plan v2 | `.agent/PRODUCTION-PLAN.md` | Locked 5-phase roadmap (all phases shipped) |
| Remaining Phases | `docs/superpowers/plans/2026-06-05-remaining-phases.md` | Task groups A-H for Phases 4-5 (shipped) |
| Convergence | `.agent/convergence/2026-06-05-production-readiness.md` | Production-readiness verdict (READY TO MERGE) |
| Missing | `docs/superpowers/plans/2026-07-14-production-readiness.md` | Referenced in PLAN.md but never committed to any branch |

## Recommended Sequencing (Lead DAG)

```
Lane 1 (security):  GitHub secret scanning → env var audit → header verification
Lane 2 (infra):     Vercel env completeness → Datadog env fix → redeploy
Lane 3 (e2e):       Stripe webhook verify → Calendly e2e test → lead pipeline smoke
                    (blocked on Lane 2 env vars)
```

All Lane 1 + 2 items are operator actions (Vercel dashboard / GitHub settings).
Lane 3 depends on Lane 2 completion.
