# dobeu.net — Remaining Phases (4 + 5 + Legacy Cutover) — Design

**Date:** 2026-06-05
**Branch:** `test/coverage` (HEAD `4cc72f2`, Phase 3 live on `https://dobeu.net`)
**Author:** fullstack-architect
**Supersedes nothing — extends:** `.agent/PRODUCTION-PLAN.md` §5 (Phases 4–5) + §6 (DB migration)
**Companion plan:** `docs/superpowers/plans/2026-06-05-remaining-phases.md`

---

## 1. Executive summary

Phases 0–3 shipped and are **live on production**. What remains is hardening, hygiene, and the one user-gated data migration:

- **Phase 4 — Auth hardening** (~1–2d): Supabase TOTP MFA for the single admin, enforced as an AAL2 gate on `/admin/*`; Intercom Identity Verification (HMAC). Both plumbing paths already exist (`IntercomIdentify` accepts `user_hash`; `identifyIntercom` forwards it) — only the server-side signing + enrollment UI + middleware gate are missing.
- **Phase 5 — Polish** (~3–5d): re-run dead-code analysis and remove genuinely-unwired exports, physically drop the `profiles.is_admin` column, delete redundant `.cmd` scripts, expand E2E beyond smoke, a11y pass on ticket UIs, Lighthouse ≥90 verification. **CI already runs `pnpm test:ci`** (`.github/workflows/ci.yml:40` — the production plan's "make CI run tests" item is already done; CLAUDE.md is stale on this).
- **Legacy DB cutover** (Phase 1 tail): inventory → mapping SQL → one-shot dump+restore → 7-day soak → retire `db-dobeutech-unified`. **User-gated** on running the read-only inventory queries in `.agent/migration/inventory.md`. The target Supabase has empty user data today, so nothing blocks the code-side phases.
- **Operational close-out**: verify Stripe webhook registration, run the end-to-end ticket→quote→accept→pay smoke path, merge `test/coverage` → `main`.

**Recommended sequencing: Approach B (parallel streams).** The four code-side workstreams (MFA, HMAC, CI/E2E, dead-code/hygiene/a11y) share almost no files and have no ordering dependency, so they dispatch as independent parallel agents the moment the user approves. The legacy cutover runs on the user's own clock (it's blocked on a human action, not code) and converges last. Total wall-clock with parallelism: **~3–4 days of agent work + the user's inventory/cutover window**, versus ~6–8 days strictly sequential.

**Decision gates: effectively none blocking.** Prior decisions (stay on Supabase, single admin, Intercom-replaces-messages, work-orders built) are locked. Two low-stakes confirmations remain (whether to physically drop `is_admin` now vs. after cutover; which `.cmd` scripts to keep) and are defaulted in §8.

---

## 2. Current-state audit

Verified by reading the listed files at HEAD `4cc72f2`.

| Area | Production-plan expectation | Actual state (verified) | Remaining |
|---|---|---|---|
| Stripe client | Phase 3 | `lib/stripe.ts` present | — |
| Stripe webhook | Phase 3 | `app/api/webhooks/stripe/route.ts` present | Verify URL registered in Stripe Dashboard (user) |
| `profiles.stripe_customer_id` | Phase 3 | `supabase/migrations/20260615000000_phase3_stripe_customer_id.sql` present | — |
| Ticket UIs | Phase 3 | `app/portal/tickets/{page,[id]/page}.tsx`, `app/admin/tickets/{page,[id]/page}.tsx` present | a11y pass (Phase 5) |
| Work-order notifications | Phase 3 | `lib/actions/work-orders.ts` wires `sendEmail` + templates; Intercom event deferred to Phase 4 (comment line 139) | Optional Intercom `work_order_created` event |
| CI runs tests | Phase 5 ("make CI run tests") | **Already done** — `ci.yml:40` runs `pnpm test:ci` | Doc fix only (CLAUDE.md stale) |
| Admin gate | env-driven | `isAdminEmail()` in `lib/utils.ts`, used by middleware + admin layout + `requireAdmin()` | Add AAL2 (MFA) layer |
| Intercom HMAC | Phase 4 | `user_hash` prop threaded through `IntercomIdentify` → `identifyIntercom`; **no server-side signing, no `INTERCOM_IDENTITY_VERIFICATION_SECRET`** | Build server hash + wire into both layouts |
| TOTP MFA | Phase 4 | none | Enroll UI + verify + middleware AAL2 gate |
| `profiles.is_admin` | drop column (Phase 5) | RLS/trigger dependence removed (`20260605…_phase1_reconciliation.sql`); **column still physically present** | New migration to `drop column` + types regen |
| `lib/analytics-server.ts` | "create or delete reference" (Phase 2) | **still missing**; confirm no dangling import remains | Verify + remove any reference, or drop the gap |
| `.cmd` scripts | keep 3 (plan §8.7) | the named "keep" 3 already deleted in Phase 2; **12 different scripts present now** | Re-triage; keep `start-dev.cmd` + `deploy-vercel.cmd`, delete redundant git-wrappers |
| Dead-code list | "8 unwired exports" | `.reports/dead-code-analysis.md` is **stale** (Phase-1 branch); `identifyIntercom`/Datadog hooks now wired | Re-run knip/ts-prune, delete only fresh hits |
| Legacy cutover | one-shot dump+restore | inventory runbook present, **Findings unfilled**; target has empty user data | User runs inventory → author mapping SQL → cutover |
| E2E | smoke-only | `e2e/*` smoke | Add ticket-flow journey |
| Rate-limit | Upstash (Phase 4, plan §8.3) | in-memory per-IP in `/api/lead` | Upstash **or** documented accepted risk |

---

## 3. Approaches for the remaining work

### Approach A — Sequential (Phase 4 → legacy cutover → Phase 5 → merge)
One stream, in plan order. **Pros:** simplest to reason about; no cross-stream coordination; each gate fully closes before the next opens. **Cons:** the legacy cutover sits in the middle and is **blocked on a human action** (running inventory queries), so everything downstream stalls on the user's clock; wall-clock ~6–8 days even though most work is independent. **Best when:** a single operator wants zero context-switching and isn't time-pressured.

### Approach B — Parallel streams (recommended)
Dispatch the independent code-side workstreams (MFA, HMAC, CI/E2E, dead-code/hygiene/a11y) as concurrent agents immediately on approval; run the legacy cutover as its own gated stream on the user's clock; converge on a final merge + smoke. **Pros:** ~3–4 days agent wall-clock; the human-bottlenecked stream (inventory) overlaps with productive code work instead of blocking it; clean file-ownership boundaries (see §7) keep agents from colliding. **Cons:** requires the file-touch discipline in §7 and a convergence/merge step; two agents lightly contend on `app/{admin,portal}/layout.tsx` (resolved by sequencing B after A — see §7). **Best when:** work is genuinely independent and one stream is gated on a human — exactly this situation.

### Approach C — Ship polish first (merge to main now, harden post-launch)
Merge `test/coverage` → `main` immediately (prod already runs this code), then do Phase 4 + cutover as post-launch follow-ups. **Pros:** fastest path to a clean `main`; reflects that prod is already on Phase 3. **Cons:** ships an admin surface with **no MFA** and an Intercom widget that's **spoofable** to `main` as the blessed baseline; invites "we'll harden later" drift on the exact security items that are cheap now. **Best when:** there were external pressure to cut a release — there isn't; prod is already live.

**Recommendation: B.** The decisive factor is that the legacy cutover is gated on a human action, so sequencing (A) wastes the user's think-time, and shipping-first (C) blesses an unhardened admin surface as `main`. B runs auth hardening and hygiene in parallel during the user's inventory window, then merges a fully-hardened branch. Within B, the cutover stream stays internally sequential (inventory → mapping → cutover → soak) because its steps are strictly ordered and destructive.

---

## 4. Phase 4 design — Auth hardening

### 4.1 Supabase TOTP MFA (admin AAL2 gate)

**Goal:** the single admin (`jeremyw@dobeu.net`) must present a TOTP factor to reach `/admin/*`. Clients (`/portal/*`) are unaffected.

**Supabase primitives** (`@supabase/supabase-js` `auth.mfa.*`, already a dependency):
- `enroll({ factorType: 'totp' })` → returns `{ id, totp: { qr_code, secret, uri } }`.
- `challenge({ factorId })` → `{ id }`.
- `verify({ factorId, challengeId, code })` → upgrades the session to **AAL2**.
- `getAuthenticatorAssuranceLevel()` → `{ currentLevel, nextLevel }`. When a verified TOTP factor exists, `nextLevel === 'aal2'`; a session that has completed a TOTP challenge has `currentLevel === 'aal2'`.

**Components & data flow:**

```
Enrollment (one-time, in portal/settings):
  /portal/settings  ──renders──▶  components/portal/MfaEnroll.tsx  ("use client")
       │                               │ supabase.auth.mfa.enroll() → QR + secret
       │                               │ user scans in authenticator app
       │                               │ enters 6-digit code
       │                               ▼
       │                          supabase.auth.mfa.challenge() + verify(code)
       │                               │ on success → factor is 'verified'
       ▼                               ▼
   (Account section shows "2FA: Enabled ✓" or the enroll widget)

Gate (every /admin/* request):
  middleware (lib/supabase/middleware.ts)
       │ existing: user exists + isAdminEmail(email)
       │ NEW: const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
       │      if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') → redirect /portal/settings/mfa
       ▼
   pass → admin content
```

**File paths:**
- Create `components/portal/MfaEnroll.tsx` — `"use client"`; enroll → render `qr_code` (SVG data-URL from Supabase) + manual secret fallback; code input → `challenge` + `verify`; sonner toast on success; calls `router.refresh()`.
- Create `components/portal/MfaStatus.tsx` (or fold into `MfaEnroll`) — reads `auth.mfa.listFactors()`; shows enrolled/not-enrolled; "Disable" calls `auth.mfa.unenroll({ factorId })`.
- Create `app/portal/settings/mfa/page.tsx` — dedicated AAL2 step-up page the middleware redirects an admin to when they have a factor but haven't satisfied the challenge this session (renders a code-only `challenge`+`verify` form, no re-enroll).
- Modify `app/portal/settings/page.tsx` — add a "Two-factor authentication" section mounting `MfaStatus`/`MfaEnroll`.
- Modify `lib/supabase/middleware.ts` — inside the existing `if (path.startsWith("/admin"))` block, after the `isAdminEmail` check, add the AAL2 assertion + redirect to `/portal/settings/mfa?next=<path>`.

**Why middleware (not admin layout) for the gate:** the gate belongs at the same boundary as the existing admin email check so there is one enforcement point. `getAuthenticatorAssuranceLevel()` works on the `createServerClient` instance already constructed in `updateSession`.

**Error handling:**
- Enroll while a factor already exists → Supabase returns an error; surface "2FA already enabled" and short-circuit to status view.
- Wrong code on verify → Supabase `verify` rejects; show inline "Invalid code, try again" without losing the challenge (re-`challenge` on next attempt).
- Admin with **no** factor at all (`nextLevel !== 'aal2'`): **do not lock them out** — `currentLevel === nextLevel === 'aal1'` means no factor enrolled, so the gate passes (bootstrap path) but the admin layout shows a persistent "Enable 2FA" banner. This avoids a chicken-and-egg lockout for the very first enrollment. (Once enrolled, `nextLevel` becomes `aal2` and the gate enforces.)
- Middleware MFA call failure (network) → fail **closed** for `/admin` (redirect to `/portal/settings/mfa` with an error note), since the admin surface is the sensitive one.

**Testing approach:**
- Unit: a pure helper `requiresAal2Stepup(aal)` extracted to `lib/utils.ts` (input `{ currentLevel, nextLevel }` → boolean) with a truth table test (`aal1/aal1`→false bootstrap, `aal1/aal2`→true gate, `aal2/aal2`→false). Keeps the branching logic testable without mocking middleware.
- Integration/manual: enroll in a dev session, confirm `/admin` redirects to step-up until the code is entered, then passes. (No automated browser MFA test — TOTP codes are time-based; out of scope per YAGNI.)

### 4.2 Intercom Identity Verification (HMAC)

**Goal:** Intercom must reject a spoofed `user_id`. The plumbing already exists — `IntercomIdentify` takes a `user_hash` prop and `identifyIntercom` forwards it to `intercomUpdate`. Missing: the server-side HMAC and the env var.

**Algorithm:** `user_hash = HMAC_SHA256(key = INTERCOM_IDENTITY_VERIFICATION_SECRET, data = user_id)`, hex digest. (Intercom hashes the **identifier** you send — here `user_id`, the Supabase UUID, which is what both layouts already pass.)

**Components & data flow:**

```
app/portal/layout.tsx (server component)   app/admin/layout.tsx (server component)
        │ user = supabase.auth.getUser()           │ (same)
        │ user_hash = intercomUserHash(user.id) ────┤
        ▼                                            ▼
   <IntercomIdentify user_id user_hash ... />   <IntercomIdentify user_id user_hash ... />
        │ (client) effect → identifyIntercom({ ..., user_hash })
        ▼
   Intercom Messenger verifies hash against the workspace secret
```

**File paths:**
- Create `lib/intercom-hmac.ts` — server-only (uses `node:crypto`); exports `intercomUserHash(userId: string): string | undefined` returning the hex HMAC, or `undefined` when `INTERCOM_IDENTITY_VERIFICATION_SECRET` is unset (graceful no-op so dev without the secret still boots Intercom anonymously). **Separate file** from `lib/intercom.ts` because `lib/intercom.ts` is deliberately importable from both server and client (it holds `intercomNameFromUser`); `node:crypto` must never reach the client bundle.
- Modify `app/portal/layout.tsx` — import `intercomUserHash`, compute `user_hash`, pass to `IntercomIdentify`.
- Modify `app/admin/layout.tsx` — same.
- Env: add `INTERCOM_IDENTITY_VERIFICATION_SECRET` (server-only) to Vercel + `.env.local`; document in `CLAUDE.md` env table.

**Error handling:** secret unset → `intercomUserHash` returns `undefined`, `IntercomIdentify` receives no `user_hash`, Intercom boots in unverified mode (current behavior). No throw. Once the secret is set in Intercom's dashboard **and** Vercel, verification is enforced by Intercom.

**Testing approach:**
- Unit (`lib/intercom-hmac.test.ts`): known-vector test — fixed secret + fixed `user_id` → assert exact expected hex digest (compute the expected value once with a one-liner and pin it). Plus: unset secret → returns `undefined`.

### 4.3 Rate-limit durability (plan §8.3)

In-memory per-IP limiter in `app/api/lead/route.ts` resets per serverless instance. **Recommendation: document accepted risk for v1** rather than add Upstash — single low-volume site, abuse impact is bounded (lead spam, not data loss), and adding Upstash introduces a new managed dependency + env for marginal value (YAGNI). Capture as an explicit accepted-risk note in `CLAUDE.md`; revisit if lead spam is observed. (Upstash remains the documented upgrade path.)

---

## 5. Legacy DB cutover design (user-gated)

Restates `.agent/PRODUCTION-PLAN.md` §6 with current-state corrections. The target Vercel Supabase has **empty user data** (per `STATUS.md`), so this is a backfill of legacy rows, not a merge.

**Strategy: one-shot dump + restore with a brief write freeze** (plan §6 option a). Single operator, low volume, the only live writers (`processLead()` + Calendly webhook) are pausable.

**Pipeline:**
1. **Inventory (USER):** run the read-only queries in `.agent/migration/inventory.md` against `db-dobeutech-unified`; paste raw output into its Findings section. This is the only blocking step and it's the user's.
2. **Author staging restore + mapping SQL (agent, after Findings):** restore legacy dump into a `legacy_import` schema on the target; author `insert into public.X select … from legacy_import.Y` per the §6.2 mapping table (leads dedupe-by-email; FK uuid map in a temp table; status-string → enum normalization). `auth.users` imported via Supabase Admin API (`auth.admin.createUser`), not bulk insert.
3. **Storage copy:** legacy `project-files` bucket → target `project-files` bucket; verify `project_files.storage_path` resolves.
4. **Cutover:** freeze writes (pause Calendly webhook + `/api/lead` maintenance), final `pg_dump`, run restore+mapping, verify gates (row-count parity allowing documented dedupe, magic-link login for one migrated user, one project+files visible), re-enable writes.
5. **Verification gates** (§6.5): pre-cutover row-count parity + schema diff; at-cutover render + real-lead-insert + login smoke; post-cutover 24h watch.
6. **Rollback** (§6.6): legacy stays read-only + live 7 days; rollback = revert the four Supabase env vars on Vercel + redeploy. Lossless within the soak because writes were frozen.
7. **Retire** `db-dobeutech-unified` at day 7.

**Code cleanup gated on cutover completion** (do NOT run before data lands): none of the Phase-1 lead-table/bookings-fallback cleanups remain (already shipped in Phase 1). The only post-cutover code touch is confirming `lib/database.types.ts` matches the post-cutover schema (`pnpm db:types`).

**Note:** §6.3 step 6 ("swap env on Vercel") may be a **no-op** if the live deployment already points at the target Supabase — confirm during inventory which project the four `*_SUPABASE_*` envs resolve to (open follow-up, plan §9).

---

## 6. Phase 5 design — Polish

### 6.1 CI test gate — ALREADY DONE
`.github/workflows/ci.yml:40` already runs `pnpm test:ci` between lint and build. **No CI change needed.** Action: correct the stale CLAUDE.md "CI does NOT run tests" note (it now does). This reclassifies a plan item from "build" to "doc fix."

### 6.2 Dead-code removal — re-derive, don't trust the stale list
`.reports/dead-code-analysis.md` is from the Phase-1 `feat/calendly-webhook` branch; several "unwired" exports (`identifyIntercom`, Datadog hooks) are now wired by Phase 2–3. **Action:** re-run `pnpm dlx knip` + `pnpm dlx ts-prune` at HEAD, then delete only **freshly-confirmed** unused exports. Candidate survivors likely still unused (verify before deleting): `lib/apollo.ts#logApolloActivity`, `lib/analytics.ts#identify`, `lib/supabase/client.ts#isSupabaseConfigured`, `lib/utils.ts#sleep`. Keep `lib/utils.ts#env` only if genuinely unreferenced (it's a public helper). Each deletion is its own micro-commit so a mistaken removal is trivially revertable.

### 6.3 Drop `profiles.is_admin` column
RLS/trigger dependence already removed (`20260605…_phase1_reconciliation.sql`, TODO at line 48). **Action:** new migration `supabase/migrations/<ts>_phase5_drop_is_admin.sql` → `alter table public.profiles drop column if exists is_admin;`. Then `pnpm db:types` to regenerate `lib/database.types.ts`. Grep the repo for `is_admin` first to confirm zero app-code references (expected: only the migration + comments). **Sequencing:** this migration must land **after** any legacy cutover that restores into `profiles`, OR the mapping SQL must not reference `is_admin`. Default recommendation: drop it now (target is empty), and ensure cutover mapping SQL omits the column.

### 6.4 `.cmd` script hygiene
12 scripts present (the plan's named "keep 3" were already deleted in Phase 2, so that guidance is stale). These are operator convenience git-wrappers; nothing in the app imports them. **Action:** keep `start-dev.cmd` and `deploy-vercel.cmd` (genuinely distinct utilities); delete the redundant git-push wrappers (`commit-all`, `commit-fixes`, `commit-gtm-and-push`, `commit-push`, `fix-build-and-push`, `init-github`, `just-push`, `push-observability`, `push-vercel-fix`, `unstick-and-push`). Confirm with the user before deleting (CLAUDE.md flags `.cmd` files as "confirm intent" — see §8 gate). Also covers the two untracked ones in `git status` (`commit-gtm-and-push.cmd`, `just-push.cmd`).

### 6.5 A11y pass — scope
Target: ticket UIs added in Phase 3 (`app/{portal,admin}/tickets/*` + their components). Checks: every interactive control keyboard-reachable + visible focus ring; status badges have text (not color-only); the create-ticket modal traps focus + restores on close + has `aria-labelledby`; the "Accept Quote" button has an accessible name including the amount; file-upload dropzone has a keyboard-accessible `<input type=file>` fallback; tables have `<caption>`/`scope`. Tooling: `axe` DevTools manual run + keyboard walkthrough. No automated axe-in-CI for v1 (YAGNI).

### 6.6 E2E expansion — scope
Current `e2e/*` is smoke. Add one Playwright journey covering the **client-visible** ticket flow against a seeded test user: load `/portal/tickets` → open create modal → submit a ticket → see it in the list → open detail → (with a pre-quoted fixture) click Accept Quote → see status flip. Admin-side quote/status transitions and Stripe payment stay out of the automated E2E (require admin session + Stripe test webhooks; covered by unit tests + the manual operational smoke in §G). Keep E2E hermetic: seed via a fixture/setup, don't depend on prod data.

### 6.7 Lighthouse ≥90
Informational gate (not a build blocker per CLAUDE.md). **Action:** run Lighthouse on `/` and `/portal` after the a11y pass; fix only regressions that drop below 90 (lazy-load any heavy embeds, confirm no new render-blocking scripts from the consent-gated analytics). Record scores in the plan's verification section.

### 6.8 `lib/analytics-server.ts`
Referenced in README per CLAUDE.md but file is missing. **Action:** grep for any import of it; if zero references, **remove the gap** (delete the doc reference) per YAGNI — do not create a server-analytics module speculatively. If a reference exists and is load-bearing, create a minimal real module. Default: it's a dangling doc reference → fix the doc.

---

## 7. Parallel execution map

Workstreams that can run as independent parallel agents after approval, grouped so no two agents in the same wave write the same file.

| Stream | Owns (writes) | Reads-only | Depends on | Wave |
|---|---|---|---|---|
| **A. MFA** | `components/portal/MfaEnroll.tsx`, `components/portal/MfaStatus.tsx`, `app/portal/settings/mfa/page.tsx`, `app/portal/settings/page.tsx`, `lib/supabase/middleware.ts`, `lib/utils.ts` (+`requiresAal2Stepup`), `app/admin/layout.tsx` (banner) | `lib/actions/auth.ts` | — | 1 |
| **B. Intercom HMAC** | `lib/intercom-hmac.ts`, `lib/intercom-hmac.test.ts`, `app/portal/layout.tsx`, `app/admin/layout.tsx` | `lib/intercom.ts`, `IntercomIdentify.tsx` | — (but see overlap) | 1→2 |
| **C. Legacy cutover** | `.agent/migration/inventory.md` (Findings), new mapping SQL files under `.agent/migration/`, `lib/database.types.ts` (post-cutover) | all `supabase/migrations/*` | **USER inventory** | gated |
| **D. CI + E2E** | `e2e/tickets.spec.ts` (new), `CLAUDE.md` (CI-runs-tests fix) | `.github/workflows/ci.yml`, `app/portal/tickets/*` | — | 1 |
| **E. Dead-code + hygiene** | deleted `.cmd` files, `supabase/migrations/<ts>_phase5_drop_is_admin.sql`, `lib/database.types.ts`, `lib/*` export sites, `CLAUDE.md` | knip/ts-prune output | — (types-regen vs C) | 1 |
| **F. A11y + perf** | `app/{portal,admin}/tickets/*` + ticket components | Lighthouse output | — | 1 |
| **G. Close-out** | merge commit, smoke script | everything | **A,B,D,E,F done; C soaked** | final |

**File-touch overlap analysis (the only real collisions):**
- **A ∩ B on `app/admin/layout.tsx`:** A adds an "Enable 2FA" banner; B adds `user_hash`. **Resolution:** run B in wave 2 after A, OR assign *all* `app/{admin,portal}/layout.tsx` edits to B and have A only emit the banner via a child component A owns. Recommended: **B after A** (B is tiny — ~1 line per layout).
- **A ∩ B on `app/portal/layout.tsx`:** only B touches it (A touches `settings`, not the portal root). No collision.
- **C ∩ E on `lib/database.types.ts`:** both regenerate types. **Resolution:** E's `is_admin` drop lands first (target empty); C's post-cutover regen is the final word and simply re-runs `pnpm db:types`. Sequence E before C's regen, or have C's regen be the authoritative last step. No manual edits to the generated file by either.
- **CLAUDE.md touched by D and E:** D fixes the CI note, E updates dead-code/`.cmd`/env tables. **Resolution:** assign **all CLAUDE.md edits to E** (single owner); D reports the CI-note correction to E rather than editing.
- **`lib/utils.ts` (A adds `requiresAal2Stepup`) vs E (may remove `sleep`):** different functions, but same file. **Resolution:** A owns `lib/utils.ts` edits in wave 1; E's dead-code removal of `lib/utils.ts` exports waits for wave 2 (or E skips `lib/utils.ts` and only touches `lib/apollo.ts`/`lib/analytics.ts`/`lib/supabase/client.ts`).

**Net:** Wave 1 = A, D, E(non-`lib/utils.ts`, non-CLAUDE-CI), F in parallel + C's inventory on the user's clock. Wave 2 = B (layouts), E finishes CLAUDE.md. Final = G after C soaks. **4 parallel agents in wave 1** is the practical maximum without collisions.

---

## 8. Decision gates

Minimal — prior decisions are locked. Defaults chosen; user can override:

1. **Drop `is_admin` now vs. after cutover?** Default: **now** (target user data is empty; cutover mapping SQL will omit the column). Override only if you want to preserve a legacy `is_admin` flag through migration for audit.
2. **`.cmd` scripts to keep?** Default: keep `start-dev.cmd` + `deploy-vercel.cmd`, delete the 10 git-wrappers. CLAUDE.md asks to confirm `.cmd` intent before deleting — this is that confirmation.
3. **Rate-limit: Upstash or accepted risk?** Default: **accepted risk for v1**, documented in CLAUDE.md. Override if you want durable limiting now.
4. **`lib/analytics-server.ts`: create or drop reference?** Default: **drop the dangling doc reference** (no current importer). Override if server-side analytics is actually wanted.
5. **Intercom `work_order_created` event** (deferred from Phase 3, comment at `work-orders.ts:139`): default **include in Phase 4 HMAC stream** (cheap, same file). Override to defer to backlog.

None of these block dispatching wave 1.

---

## 9. Success criteria — "production ready"

- **Auth:** admin login to `/admin/*` requires a TOTP code (AAL2); a session without it is redirected to step-up. Intercom rejects an identify call with a mismatched `user_hash` (verified against the workspace secret). Unit tests green for `requiresAal2Stepup` + `intercomUserHash`.
- **Data:** legacy `db-dobeutech-unified` rows present in the target with row-count parity (allowing documented lead dedupe); one migrated user logs in via magic link and sees their project + files; legacy held read-only for the 7-day soak, then retired.
- **Hygiene:** `profiles.is_admin` column dropped; `lib/database.types.ts` regenerated; redundant `.cmd` scripts removed; freshly-confirmed dead exports removed; CLAUDE.md corrected (CI runs tests; env table includes `INTERCOM_IDENTITY_VERIFICATION_SECRET`).
- **Quality:** `pnpm verify` green (type-check + lint + `test:ci` + build); CI green on `main`; ticket-flow E2E passes; ticket UIs pass axe + keyboard walkthrough; Lighthouse ≥90 on `/` and `/portal`.
- **Operational:** Stripe webhook URL confirmed registered (`https://dobeu.net/api/webhooks/stripe`) and a $1 live-mode invoice round-trips to `paid` via the webhook; `test/coverage` merged to `main`; post-merge smoke script green.

---

## Spec self-review

- **Placeholder scan:** no TBD/TODO/"handle later" left as instructions; the only `TODO` mentioned is the pre-existing one in the reconciliation migration (quoted as evidence, line 48), not a plan placeholder. ✔
- **Consistency:** file paths cross-checked against verified HEAD reads (`lib/supabase/middleware.ts`, `app/admin/layout.tsx`, `lib/intercom.ts`, `IntercomIdentify.tsx`, `lib/utils.ts`, `ci.yml`, migrations list). `requiresAal2Stepup` / `intercomUserHash` named identically in §4, §7, §9 and in the companion plan. ✔
- **Scope:** every item traces to PRODUCTION-PLAN §5/§6 or a verified gap; YAGNI applied to rate-limit (accepted risk), analytics-server (drop reference), axe-in-CI (manual), admin-side E2E (manual). No new features invented. ✔
- **Ambiguity resolved:** corrected three stale assumptions inline (CI already runs tests; `.cmd` keep-list outdated; dead-code report stale) so the plan doesn't re-do completed work. The first-enrollment lockout edge case is explicitly designed around (bootstrap pass + banner). ✔
- **Out of scope confirmed:** Auth0 (dead), multi-admin, custom invoice UI, dual-write migration — none introduced. ✔
