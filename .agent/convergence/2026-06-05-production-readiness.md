# dobeu.net — Production Readiness Convergence

**Date:** 2026-06-05
**Branch:** `test/coverage` · **HEAD:** `6e2b013`
**Author:** fullstack-architect (operational convergence pass, post Phases 4–5 wave-1/2)
**Companion docs:** `.agent/PRODUCTION-PLAN.md` (locked roadmap) · `docs/superpowers/plans/2026-06-05-remaining-phases.md` (Task Groups A–H) · `STATUS.md` (phase tracker)

---

## 1. Executive verdict — ✅ READY TO MERGE

`test/coverage` is **code-complete and mergeable to `main`.** Phases 0–5 are implemented and committed; Phase 3 is already live on `https://dobeu.net`. There are **no code-side blockers**: nothing in `app/`, `lib/`, or `components/` references dropped/missing schema, and the four production gates (`type-check`, `lint`, `test:ci`, `build`) are green per the wave-1/2 agents.

The remaining items are **operator/config actions and a human-gated data migration — none of them block the git merge.** They block *full production cutover*, which is a separate, deliberately-sequenced step. Treat this as "merge the code now, then run the operator checklist in §3 before/at deploy."

### Not blockers (and why)

| Item | Why it does not block merge |
|---|---|
| `20260616000000_phase5_drop_is_admin.sql` not applied to live Supabase | The column drop is `drop column if exists` — idempotent and backward-safe. App code and regenerated types no longer reference `is_admin`; the live DB simply carries one unused column until the migration runs. No runtime path reads or writes it (RLS/trigger dependence was already removed in the Phase 1 reconciliation migration). This is **schema drift to reconcile at deploy**, not a code defect. |
| Legacy `db-dobeutech-unified` cutover not started | Target Vercel Supabase holds **empty user data** today — nothing to roll back, nothing the running app depends on. Gated on the user filling `.agent/migration/inventory.md` Findings. See §4. |
| Mobile landing perf ≈ 80 (target 90) | Informational gate, not a build gate. Deferral rationale in §7. |
| Stripe webhook URL / Intercom secret / Resend DKIM / Vercel↔GitHub re-link | Deploy-time configuration in third-party dashboards, not repository state. See §3. |

---

## 2. What shipped this session (Phases 1–5, code-side)

Phases 0–3 were already live (HEAD `4cc72f2`). This session landed Phases **4 and 5** on `test/coverage`:

### Phase 4 — Auth hardening
- **TOTP MFA (admin AAL2 gate).**
  - `lib/utils.ts#requiresAal2Stepup` — pure decision helper (TDD, 4 tests). Commit `1652f00`.
  - `lib/supabase/middleware.ts` — enforces AAL2 step-up on `/admin/*`, **fails closed** on MFA-check error. Commit `d5c40f1`.
  - `components/portal/MfaEnroll.tsx`, `MfaStatus.tsx`, `MfaStepUp.tsx` — enroll (QR + manual secret), status/disable, code-only step-up. Commits `996e1d2`, `ba6d8a9`.
  - `app/portal/settings/mfa/page.tsx` + 2FA section in `app/portal/settings/page.tsx`.
  - `app/admin/layout.tsx` — non-blocking "Enable 2FA" bootstrap banner. Commit `27be445`.
- **Intercom Identity Verification (HMAC).**
  - `lib/intercom-hmac.ts` (+ test) — `intercomUserHash(userId)`, server-only `node:crypto`, returns `undefined` when the secret is unset (graceful unverified boot). Commit `cfada0f`.
  - `user_hash` wired into portal + admin layouts. Commit `487fded`.
- **Rate-limit:** in-memory per-IP limiter on `/api/lead` retained as documented accepted-risk (Upstash is the upgrade path when traffic warrants).

### Phase 5 — Hygiene, a11y, perf, E2E
- **Dead-export removal** (one micro-commit each, verified zero non-test importers): `identify` (`02369c0`), `logApolloActivity` (`9a4564d`), `isSupabaseConfigured` (`e82bb9c`), internal `STRIPE_API_VERSION` (`9126def`).
- **`profiles.is_admin` drop:** migration `20260616000000_phase5_drop_is_admin.sql` authored + types regenerated. Commit `67cced5`. **Applied on live Vercel Supabase** (`ipmjokuezeuukhrilduq`, verified 2026-06-16 — see §3.1 ✅).
- **Docs:** CI-runs-tests correction, `INTERCOM_IDENTITY_VERIFICATION_SECRET` env row, `.cmd` keep-list, `analytics-server` dangling reference dropped, `is_admin` "dropped" note. Commit `e9a2266`. `.cmd` trimmed to `start-dev.cmd` + `deploy-vercel.cmd`.
- **E2E:** `e2e/tickets.spec.ts` — client ticket submit→list journey (skips cleanly when Supabase env is empty). Commit `11385be`.
- **A11y:** keyboard + ARIA fixes on ticket UIs (dialog roles, focus management, accessible names, focus rings). Commit `7864198`.
- **Perf:** landing lazy-load + LCP fix → desktop Lighthouse ≥ 90. Commit `6e2b013`. Mobile landing ≈ 80 (deferred, §7).

---

## 3. Human operator checklist (run before / at production cutover)

These are **not** repository changes. Numbered in recommended order.

### 3.1 Apply the `is_admin` drop migration to live Supabase — ✅ **complete (2026-06-16)**
Applied on Vercel Marketplace Supabase `ipmjokuezeuukhrilduq` (operator manual SQL + agent read-only verify).

- **Verify command:** `node .agent/scripts/apply-phase5-migration.mjs` → `is_admin column present: NO`
- **SQL verify:** `select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_admin';` → **0 rows**

### 3.2 Provision Intercom Identity Verification
1. Vercel → Project → Settings → Environment Variables: add `INTERCOM_IDENTITY_VERIFICATION_SECRET` (server-only, all environments) and redeploy.
2. Intercom → Settings → Security → **Identity Verification** → enable for **Web** and paste the **same** secret.
3. Verify: load `/portal` as a signed-in user; Intercom should boot **verified** (no "unidentified" warning in the Intercom dashboard).

### 3.3 Verify the Stripe webhook endpoint
1. Stripe Dashboard → Developers → Webhooks → confirm an endpoint for `https://dobeu.net/api/webhooks/stripe`.
2. Subscribed events: `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`.
3. Confirm the endpoint's **signing secret** matches `STRIPE_WEBHOOK_SECRET` in Vercel.
4. Send a test event (`invoice.paid`) → expect **200** in the endpoint log and the local invoice row to flip status.

### 3.4 Verify Resend sending-domain DKIM/SPF
- Resend → Domains → `dobeu.net` → confirm **DKIM + SPF verified** before relying on quote/status emails at volume (otherwise they land in spam). Confirmation/notification sends are best-effort/non-fatal, so this is not a hard blocker, but it gates email deliverability.

### 3.5 Re-link Vercel ↔ GitHub
- Vercel → Project → Settings → Git → confirm the GitHub connection so `main` auto-deploys post-merge. Reconnect if the integration shows detached.

> **Top 3 by leverage:** (1) ~~apply the `is_admin` drop migration (§3.1)~~ ✅, (2) provision the Intercom HMAC secret in Vercel + Intercom (§3.2), (3) verify the Stripe webhook endpoint + signing-secret match (§3.3).

---

## 4. Legacy cutover status + when to run

**Status: Task Group C started — inventory blocked on user.** Cutover runbooks authored; mapping SQL pending Findings.

- The target Vercel Supabase has **empty user data**; the live app reads/writes the target already.
- **Quick start:** `.agent/migration/RUN-INVENTORY-NOW.md` (3 highest-value SQL queries). Full runbook: `.agent/migration/inventory.md`. Execute path: `.agent/migration/cutover-execute.md`.
- The cutover is **blocked on Task C1**: paste raw output into `inventory.md` **Findings** (currently **unfilled**). No `LEGACY_DATABASE_URL` in local `.env.local` — automated inventory not attempted.
- **When to run:** on the operator's clock. Sequence: fill Findings → agent authors `restore-staging.sql` + `mapping.sql` → execute per `cutover-execute.md` → 7-day legacy read-only soak.
- **`is_admin` interaction:** §3.1 complete — `mapping.sql` must omit `is_admin` from `profiles` insert.

---

## 5. Post-merge smoke path (reference)

The canonical end-to-end smoke (planned home: `scripts/post-merge-smoke.md`, Task G2 — **not yet authored**; create it as the merge artifact). The path to walk against production:

1. Client signs in → `/portal/tickets` → **New request** (service type, title, description, attach a file ≤ 25 MB).
2. Ticket appears in the client list and in `/admin/tickets`.
3. Admin opens the ticket → enters a **quote** (`quoteWorkOrder`) → client receives the Resend "you've been quoted" email.
4. Client clicks **Accept Quote** (amount via `formatCurrency`) → status → `accepted`.
5. Admin clicks **Create Stripe Invoice** → `stripe_invoice_id` + `hosted_invoice_url` stored; `work_orders.invoice_id` linked.
6. Client opens `/portal/invoices` → **Pay** → Stripe-hosted page → pays a **$1 live invoice** for the live check.
7. `/api/webhooks/stripe` receives `invoice.paid` → flips `invoices.status` → `paid`; both portal + admin reflect it.

**Auth smoke:** admin with a verified TOTP factor is redirected to `/portal/settings/mfa` step-up before `/admin` loads; correct code → admin renders. Admin with no factor sees the bootstrap banner but is not locked out.

---

## 6. Recommended merge strategy — **PR, not direct merge**

Open a PR `test/coverage` → `main` and merge via the PR after CI is green (per plan Task G3). Rationale:
- The branch spans two phases and many commits; a PR gives a single reviewable diff, a CI gate, and a clean merge record.
- **No force-push to `main`.** Push the branch, let CI re-run `install + type-check + lint + test:ci + build`, then squash-or-merge via the PR UI.
- Run `pnpm verify` locally first to mirror CI before pushing.
- Use the PR body template already drafted in the plan (Task G3 Step 2) and check off the test-plan items as §3/§5 are completed.

---

## 7. Phase 5 mobile-perf deferral rationale (informational)

Mobile landing Lighthouse Performance sits at **≈ 80** vs the **90** target; desktop is **≥ 90**. Deferral is acceptable per the remaining-phases design doc:
- Lighthouse targets are an **informational quality bar, not a build gate** (`strict-build.mjs` does not fail on Lighthouse). Merge correctness is unaffected.
- The landing already lazy-loads heavy embeds (booking/Typeform lightbox) and analytics are consent-gated, so the remaining mobile gap is dominated by third-party/network factors with diminishing returns, not render-blocking app code.
- The fix (further deferring/road-mapping third-party widgets, image weight tuning) is **isolated to the landing surface** and can land as a follow-up perf commit without touching portal/admin/auth code — so it carries no merge risk.
- Action: track as a non-gating follow-up; revisit with field data after production traffic resumes.

---

## 8. `lib/utils.ts#sleep` recommendation

**Remove it.** A fresh grep at HEAD `6e2b013` shows `sleep` appears **only in its own definition** in `lib/utils.ts` plus stale mentions in `.reports/dead-code-analysis.md` and the plan/design docs — **zero non-test importers anywhere in `app/`, `lib/`, or `components/`**. It is genuinely dead, exactly as the plan's Task E1 candidate list predicted; Agent E simply deferred it under the wave-2 `lib/utils.ts` single-writer rule (to avoid colliding with Agent A's `requiresAal2Stepup` add), and that collision risk is now gone since both edits would be sequential. Drop the one-line export (lines 95–98) in a standalone `chore(p5): remove unused export sleep` micro-commit — trivially revertable if a future retry loop wants it back. (Note: `env()` at lines 11–23 is *also* currently unimported, but per the design doc it's an intentional public env-reader helper — keep it; do not bundle it into the `sleep` removal.)

---

## Appendix — verification snapshot

- Commits A–F present on `test/coverage` (`1652f00` → `6e2b013`); HEAD matches.
- Artifacts confirmed on disk: `lib/intercom-hmac.ts`, `components/portal/Mfa{Enroll,Status,StepUp}.tsx`, `e2e/tickets.spec.ts`, `supabase/migrations/20260616000000_phase5_drop_is_admin.sql`.
- `.agent/migration/inventory.md` present; **Findings unfilled** (cutover not started).
- Run `pnpm verify` (type-check + lint + test:ci + build) before opening the PR to confirm the green snapshot at merge time.
