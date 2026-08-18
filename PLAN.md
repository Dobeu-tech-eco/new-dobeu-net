# dobeu.net v3 — Plan

**Status:** Original build plan (2026-05-21) fully executed — Phases 0–5 shipped and live on `https://dobeu.net`.
This file now tracks the **active plan: production hardening + close-out**.

- **History / context:** `BRAINSTORM.md` (product decisions, data model, open questions) and `STATUS.md` (phase-by-phase shipping record).
- **Detailed task breakdown for the active plan:** [`docs/superpowers/plans/2026-07-14-production-readiness.md`](docs/superpowers/plans/2026-07-14-production-readiness.md) — step-by-step commands, file map, verification matrix. This file is the summary + sequencing; that file is the executable checklist.

---

## Part 1 — Completed build (historical record)

The original six-phase plan (repo init → landing/portal/admin parallel build → integration → verification → DNS cutover) completed between 2026-05-21 and 2026-06-17. Everything below is **done** — see `STATUS.md` for commit-level detail:

| Phase | Scope | Outcome |
|---|---|---|
| 0–1 | Approval, repo init, tokens, Supabase schema, env scaffolding | ✅ Shipped |
| 2A/B/C | Landing, auth + portal, admin + lead pipeline APIs | ✅ Shipped |
| 3 | Stripe-hosted invoicing + webhook, work-order (tickets) UI, Resend wiring, Datadog | ✅ Shipped, live |
| 4 | Supabase TOTP MFA (admin AAL2), Intercom identity verification | ✅ Code complete |
| 5 | Lighthouse/a11y polish, CI tests, `profiles.is_admin` dropped on live | ✅ Shipped |
| Legacy cutover | `db-dobeutech-unified` → Vercel Supabase | ✅ Decided NO-OP (zero portal rows); optional auth pre-seed only |

**Not done from the original plan (carried forward to Part 3):** Phase 6 post-launch scheduled automations (daily lead digest, weekly Lighthouse/uptime, monthly invoice aging).

---

## Part 2 — Active plan: production hardening sprint

**Source audit:** 2026-07-14, repo HEAD `7ce3872`, live-site header check + Vercel env inventory + Supabase policy review. Full findings in the [production-readiness plan](docs/superpowers/plans/2026-07-14-production-readiness.md).

**Approach chosen:** hardening-only first (its "Approach A") — no new marketing features until security/config gaps close.

### Critical fixes (in order)

1. **Unblock CSP — single Next config** *(Task 1)*
   `next.config.js` shadows `next.config.ts`, so the CSP/HSTS/X-Frame-Options stack **is not shipping on production responses** (verified via `curl -sI https://dobeu.net`). Merge the `.js` file's `images.remotePatterns` into `next.config.ts`, delete `next.config.js`, verify no dual-config warning on build, then confirm headers on the live site post-deploy.

2. **Production env correctness** *(Task 2 — operator/Vercel CLI)*
   Missing from Vercel: `UPSTASH_REDIS_REST_URL/TOKEN` (rate limit currently in-memory per instance), `CALENDLY_WEBHOOK_SIGNING_KEY` (webhook 503s — bookings never become leads), `TYPEFORM_WEBHOOK_SECRET`, `CUSTOMERIO_SITE_ID/API_KEY`, `GITHUB_TOKEN`, `COMPOSIO_API_KEY`/`ANTHROPIC_API_KEY` (agent surface). Wrong: `NEXT_PUBLIC_DATADOG_ENV=development` on Production/Preview. Register the Calendly + Typeform webhooks after the secrets land; redeploy and confirm auto-deploy from `main` is healthy.

3. **Merge PR #178 — GitHub repo parser SSRF/traversal fix** *(Task 3)*
   HIGH severity; `app/api/github-repo/route.ts` accepts `..` path segments on `main`. Prefer merging the open PR; otherwise implement strict segment validation with tests.

4. **Supabase RLS hygiene** *(Task 4)*
   `profiles_update_own` lacks `WITH CHECK` (ownership reassignment possible). New migration re-creating the policy with both `USING` and `WITH CHECK` on `(select auth.uid()) = id`; audit other UPDATE policies (work-order accept path); run Supabase advisors; verify RLS inventory on live.

5. **GitHub security baseline** *(Task 5)*
   Secret scanning, push protection, and code scanning are all **off** on `Dobeu-tech-eco/new-dobeu-net`. Enable them; triage open PRs (#178 security first; #177 spinner, #179 typewriter CPU are optional polish).

6. **Docs + `.env.example` alignment** *(Task 6)*
   `.env.example` still documents legacy `NEXT_PUBLIC_SUPABASE_*` names; README still marks shipped features as TODO. (`CLAUDE.md` was refreshed against the codebase 2026-07-14.)

### Verification gate (Tasks 7–8)

- `pnpm audit` + `pnpm verify` green.
- Live smoke per `scripts/post-merge-smoke.md`: `/` 200, `/portal` + `/admin` redirect to login, `/api/lead` empty POST → 400.
- `curl -sI https://dobeu.net` shows CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Permissions-Policy.
- Stripe Dashboard endpoint subscribed to `invoice.paid/payment_failed/finalized/voided` with secret matching `STRIPE_WEBHOOK_SECRET`; Resend DKIM/SPF verified; one test invoice paid end-to-end flips local status.
- Calendly test booking produces a `leads` row + notification email without manual copying.

### Success criteria

Production-ready means all ten criteria in the readiness doc, headline items: CSP live, Upstash rate limiting active, Calendly→lead path working, PR #178 closed, `profiles` `WITH CHECK` applied, GitHub secret scanning on, Datadog env correct.

---

## Part 3 — Deferred tracks (do not block Part 2)

1. **Twilio SMS MFA** *(readiness Tasks 9–10)* — Twilio Verify as secondary factor layered on existing TOTP; **blocked on a decision: admin-only, all portal users, or deferred**. Console/API-key setup first, app code second; TOTP remains the primary admin control either way.
2. **Landing conversion pack** *(readiness Task 11)* — real social proof (`Proof.tsx` re-enable with attributable quotes), case-study pages, mobile Lighthouse ≥90 (currently ~80, accepted non-gater), lead-form UX, admin leads CRM polish, optional blog/pricing.
3. **Post-launch automations** *(original Phase 6, never built)* — daily lead/booking/invoice digest, weekly Lighthouse + uptime report, monthly Stripe aging. Candidates for Make.com scenarios or Composio triggers once Part 2 lands.
4. **v2 backlog** *(BRAINSTORM §13)* — multi-language, real-time chat, team accounts, status page, native app.

## Open decisions needing Jeremy

1. SMS MFA scope (admin-only / all users / deferred) — gates deferred track 1.
2. Vercel builds on Node 24 while `.nvmrc`/CI pin 20 (`engines: >=20` allows the float) — pin Vercel to 20, or bump the policy to 22/24 deliberately.
3. Whether to enable CodeQL / CodeRabbit on the repo (plan-dependent).

## Definition of done (this plan)

- [ ] All Part 2 critical fixes merged and deployed
- [ ] Verification gate fully green (headers, smoke, Stripe/Resend/Calendly end-to-end)
- [ ] GitHub security features enabled; no open HIGH security PRs
- [ ] `STATUS.md` updated with hardening-sprint record
- [ ] Deferred-track decisions (above) captured, even if the answer is "later"
