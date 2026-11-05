# Evidence log: new-dobeu-net

Per-run accepted evidence, moved verbatim from `end-state.md` on 2026-11-03. Oldest first; a later entry supersedes an earlier one. Paths like `runs/<stamp>/` are relative to `.harness/`.

## run 20261022-172443

Ship accepted on 2026-10-23. Evidence: `runs/20261022-172443/receipt.md`, `final-verification.md`, `walkthrough.md`, and `v0.md`. P1/P2 scoped rebrand closeout and P6 local verification/receipt are accepted. Local/mock only: 696 tests, 50 positioning checks, 8 schema routes, 6 dialog walkthroughs and strict build passed. Booking means the local fallback; external Calendly remains unverified.

Per the approved run plan, broad section rows remain `todo`: this narrow patch does not establish full acceptance of those sections. Sections 14,18,19,22,25 have accepted scoped change evidence; sections 1,2,5,6,12,13 have verification-only evidence. Section 24's offer and section 14's disclosure are deferred decisions. No DB/RLS, provider or production completion is inferred.

## run 20261027-112109

Sources: four read-only audits on HEAD 2491023 (A: 1–12, 16–17; B: 13–14, 18–33, 66; C: 15, 34–61; D: 62–65). Fresh `pnpm verify` on 2491023 passed: 69 files, 710/710 tests, 0 type errors, 0 lint errors (7 known warnings), strict build. CI Verify, E2E (133 passed, 5 skipped) and Lighthouse passed on #299, #300 and #301. All "done" evidence is local/mock or source review only. No live side-effect or database verification was performed; the only remote checks were read-only (see Verification labels).

Status counts: done 55 (including 24), blocked 10 (1, 37, 38, 39, 40, 42, 43, 44, 46, 63), todo 1 (65).

Consistency rule (final review, fix round 1): a portal page whose data scoping rests only on RLS, with no owner filter in the query, shares row 1's blocker (live RLS unverified). Rows 37, 38, 39, 40, 42, 43 and 44 are blocked together. Pages with an explicit owner/company filter or an action-level guard stay done.

Verification labels (P5 taxonomy):
- **Local/mock:** every unit, integration and type check, the strict build, and every provider client test (Stripe, Calendly, Typeform, Resend, Apollo, Customer.io, Composio, Datadog, Upstash).
- **Read-only remote:** the CI E2E and local `/repos` checks, which call the live GitHub REST API through `/api/github-repo` and `/api/github-activity`; the CI Lighthouse runs (no provider writes); and the production curl and WebKit walkthrough of dobeu.net in run 20261027-084922.
- **Live side effect:** none in this run or the reconciliation inputs. No payment, invoice, email, webhook or provider configuration was exercised.

Per-section evidence is in `runs/20261027-112109/evidence.md`.

Open acceptance gaps

- P1 positioning: the PR/release filter branches are untested, and `llms.txt` and the OG image are not audited.
- P3 routes: rows 37–44 (except 41) and 46 blocked on live RLS/MFA.
- P3 types: `database.types.ts` drift is unchecked against the 10-22 migration.
- P4 admin: the middleware `/admin` gate and the admin layout are untested.
- Section 1: pgTAP is not in CI.
- Section 63: the CI Supabase E2E env is missing.
- Section 65: `CLAUDE.md:7` and `CLAUDE.md:22` are stale.
- Section 11: `CRON_SECRET` is undocumented.
- P6 architecture/agent-writing: agent-writing pass not recorded.
- Portal list pages 37/38/40/42/43 blocked with row 1 (RLS-only scoping).

## run 20261027-134130

Follow-up run for the buildable reconciliation gaps (tests and docs only, no product source). Fresh `pnpm verify`: 74 files, 750/750 tests (+40 on 710), 0 type errors, 0 lint errors (7 known warnings), strict build. An opus review approved; its MEDIUM and LOW items were fixed. The opus verifier returned VERIFIED, and its independent mutation checks failed the matching tests. Receipt: `runs/20261027-134130/receipt.md`.

- Row 65 → done: `CLAUDE.md:7` now says Next.js 16 and `:22` says `eslint`.
- Row 11 gap closed: `CRON_SECRET` is documented in `CLAUDE.md` and `docs/DEPLOYMENT.md` (Bearer, timing-safe, 401 when unset).
- P4 admin authz checked:
  - `lib/supabase/middleware.test.ts` covers the `/admin` and `/portal` gate: unauthenticated, non-admin, MFA enrolment, AAL1 step-up, AAL2 pass, a null or throwing assurance lookup failing closed, Supabase not configured, and no MFA-page loop.
  - `app/admin/layout.test.tsx` covers the layout redirects and a throwing lookup failing closed.
- P1 positioning checked:
  - PR-title and release-name filters are tested in `app/api/github-activity/route.test.ts`.
  - `lib/public-positioning.test.ts` scans `public/llms.txt` and the full `app/opengraph-image.tsx` source.
- Row 46 local gap closed: `MfaEnroll`, `MfaStepUp` and `MfaStatus` component tests (15). The row stays blocked on live TOTP (Supabase auth).
- Still open:
  - Rows 1 and 37–44 (live RLS: D9; CI pgTAP and types job: D11).
  - Row 63 (CI Supabase E2E secrets: S1).
  - P3 types.
  - P6 agent-writing pass (D10).
  - The `.env.example` `CRON_SECRET` line, which is a protected path.

## run 20261027-151152

- Row 63: `e2e/tickets.spec.ts` signs in through `verifyOtp` with session cookies, not the implicit-flow admin link. It passes against a local Supabase stack on chromium and on mobile-chrome. Mutations fail it: an invalid service-role key and a wrong assertion. CI's E2E job now starts a local stack and exports its demo keys, masked. No GitHub secrets are needed (S1 is closed).
- Rows 37, 38, 42, 43: `supabase test db` passes 32/32 (`rls_hardening.test.sql`, two-user plus company scoping on projects, invoices and work_orders). The test now runs in CI.
- Rows 39, 40, 44 stay blocked: `project_files` and `work_order_attachments` have no two-user pgTAP yet (D9 remainder).

## run 20261027-172221 (contact-form spam)

- `/api/lead` is now verify-first. Silent spam filters (hp_ref honeypot, elapsed_ms >= 1500 required, Origin allowlist, gibberish rule) drop bots with a 200 and send nothing. Clean submissions get an AES-GCM opaque 24h token, emailed as a /lead/confirm link. `processLead` runs only on a POST to /api/lead/confirm, with a per-nonce lock and nonce dedupe.
- Verifier VERIFIED:
  - unit tests 792/792 and `pnpm verify` green;
  - the live bot payload was dropped with no email and no lead row;
  - confirm, replay, tamper and expiry all behave correctly;
  - the browser walkthrough showed no POST on load, the token stripped from the URL, and no-referrer set;
  - mutations (gibberish rule, nonce dedupe, no-GET export, analytics exclusion) each fail their test.
- Final review (opus): APPROVE_WITH_CHANGES, with all changes applied.

## run 20261028-064556 (D9 remainder)

- Rows 39, 40, 44 → done. `supabase/tests/database/rls_files_attachments.test.sql` (51 assertions) covers `project_files`, `work_order_attachments` and storage buckets `project-files` and `work-order-attachments`. It tests four users: A (owner), B (unrelated), C (active company member), E (invited, not active). `supabase test db` passes 83/83 (51 new + 32) on the local stack, and CI picks the file up.
- Mutations: an extra storage SELECT policy fails cases 14 and 23. Dropping `wo_att_insert_own` fails case 40 (and case 50, which depends on it).
- Pinned as current behaviour, not fixed (Decisions items):
  - GAP 1: company members can read the table rows but not the storage objects, so signed URLs and downloads fail for them.
  - GAP 2: an owner can delete an attachment's storage object but not its row.
- Evidence is from the local stack plus CI, not production. The P3 access-boundary box stays unchecked: row 1 is blocked on D11 (types drift) and row 46 on live TOTP.
- Receipt: `runs/20261028-064556/receipt.md`.

## run 20261103-gaps (GAP 1 + GAP 2 closed)

- GAP 1 fixed by `20261103000100`: storage SELECT on both buckets = owner or active company member, matching the table policies. GAP 2 fixed by `20261103000200`: `wo_attachments_storage_delete_own` dropped.
- `rls_files_attachments.test.sql` now 56 assertions (adds disabled member F and a cross-bucket decoy); `supabase test db` 88/88 locally, 15/15 migrations applied. Mutations: restoring owner-only SELECT fails cases 3, 4, 23, 24; recreating the delete policy fails cases 4, 50, 54; a cross-bucket policy fails 3, 23, 38.
- The run 20261028-064556 mutation note above ("extra storage SELECT policy fails 14 and 23") predates this fix.
- Production: not applied until `supabase db push` (Deploy action item).

## run 20261103-d11 (types drift CI, row 1 closed)

- Row 1 → done. `lib/database.types.ts` is now generated (`supabase gen types typescript --local` + prettier) from all 20 migrations; it was a hand-written stub. Domain unions moved to `lib/domain-types.ts`.
- CI E2E job, after pgTAP: "Check generated DB types match migrations" regenerates and `diff -u`s; passed on PR #313 (CLI 2.121.0). Locally a hand-edited copy makes the diff fail.
- pgTAP in CI: `rls_hardening` (32), `rls_files_attachments` (56), `run2_storage` (42). Repo and prod migration history match 20/20 (#310).
- P3 types box checked. Evidence is local stack plus CI; production schema matched by history repair and spot checks, not a full schema diff.

## 2026-11-03 (D12, .env.example)

- `LEAD_VERIFY_SECRET=` (`.env.example:83`) and `CRON_SECRET=` (`.env.example:87`) added by Jeremy with comments and empty values. This closes the "`.env.example` `CRON_SECRET` line" gap listed under run 20261027-134130.

## 2026-11-04 (D13, lead verify-nonce uniqueness)

- `20261104000100_leads_verify_nonce_unique`: unique, non-partial `leads_verify_nonce_key` on `raw_payload->>'verify_nonce'`, with a guard that raises on duplicates. `processLead` throws `LeadAlreadyConfirmedError` on that 23505 before any fan-out; `/api/lead/confirm` answers it with the idempotent 200 and keeps the lock.
- Local: pgTAP 136/136 (new `leads_verify_nonce.test.sql` 6/6), `pnpm verify` 993/993, types drift clean. CI green on #315.
- Production: 0 duplicate nonces (46 leads, 1 with a nonce); index applied and verified; `migration list --linked` 21/21. No live confirm race was exercised.

## run 20261103-213646 (super-admin dashboard, admin-posted work, audited billing, test-customer provisioning)

- Sections extended (stay `done`): 4, 15, 47, 54, 58, 62, 63, 65. No migration, no type drift.
- Audit: every /admin page and admin action is guarded server-side (`requireAdmin` = allowlist + AAL2); every /portal read uses createClient (RLS); the only portal/company service-role read (`/company/members` resolveEmails) checks ownership first.
- New: lib/admin-audit.ts (every admin write in work-orders, invoices, projects, users, companies audits), createWorkOrderForClient + /admin/tickets Post work dialog, overview metrics + activity feed, invoice dialog without project / with linked work order, mark-paid paid/void guard, invoice duplicate guard, scripts/invite-test-customer.mjs (dry-run default, invite-only), docs/runbooks/admin-and-test-customer.md.
- Evidence (local stack + vitest, final tree): `pnpm verify` 1148/1148, strict build; pgTAP 151/151 (new admin_audit_and_company_isolation: 8x 42501 on admin_audit_log for anon/authenticated, company and no-project isolation); types drift clean; e2e 71/71 non-visual (new admin-posted-work 3/3); verifier walkthrough 3/3 portal screens. Visual tests fail locally only (linux baselines). Admin AAL2 screens not walkable locally (TOTP disabled) — Jeremy checks on Preview.
- Production: ADMIN_EMAILS set to exactly jeremyw@dobeu.net in Vercel Production + Preview (2026-11-04 02:45 UTC, metadata-verified). Nothing deployed; no production migration.
- Receipt: `runs/20261103-213646/receipt.md`. Follow-ups D28-D32.

## 2026-11-04 run 20261104-073007 (PR #326, merged 935d872) — D44 package, D45 local step-up
- D45 local leg: supabase/config.toml [auth.mfa.totp] enroll/verify on; e2e/company-step-up.spec.ts (RFC 6238 helper e2e/totp.ts) signs in AAL1, opens /company/members?company=<id>, is sent to /portal/settings/mfa?next=<exact target>, passes a real TOTP step-up and lands on the exact deep link; chromium + mobile-chrome in parallel 10/10 with tickets + admin-posted-work; mutation goes red. bypassCSP (dev CSP blocks the local Supabase URL, D51); live walk is H4 with H3.
- D44: decision package (memo, draft migration, draft pgTAP 73/73 inside BEGIN…ROLLBACK, negative control 10 not ok). `pnpm verify` 1404/1404. CI green on 7e0347e (Verify, E2E, Lighthouse, CodeQL, gitleaks, pnpm audit, claude-review, Bugbot).

## 2026-11-04 run 20261104-125154 — D44 implemented (option b)
- supabase/migrations/20261105000100_suspended_company_reads.sql: is_active_company_member (SECURITY DEFINER, STABLE, pinned search_path) on the 10 data-read policies (7 tables + 3 storage.objects); is_company_member, companies_select_member, company_members_select_comember, wo_insert_own unchanged; drift guards on the 7 tables and storage.objects (scoped to the 3 buckets). Idempotent (re-run via psql exit 0). Applied to the LOCAL stack only; production apply by Jeremy after merge.
- pgTAP: suspended_company_reads 84 (owner branch per policy, policy-set pins), all suites 269/269; mutation (one policy back to is_company_member) -> not ok.
- Portal: lib/company-status.ts + components/portal/CompanySuspendedBanner.tsx in app/portal/layout.tsx (fixed copy, role=status, fail quiet); walkthrough 8/8 (light/dark, 390/1440) on a locally seeded suspended company: banner shown, own project visible, company-shared project hidden.
- `pnpm verify` 1417/1417, strict build clean; lib/database.types.ts drift = the one new function.
- P3 access-boundary box stays unchecked (L-011): this adds evidence for company-shared reads, not every route.
## 2026-11-04 run 20261104-124711 — D47 accept-invite flow (sections 4, 36, 37)
- New: lib/company-invites.ts (listPendingInvites, respondToInvite → acceptInvite/declineInvite, requireMailboxProof, isCompanyActive), lib/actions/invites.ts (accept/decline + form wrappers), components/portal/PendingInvites.tsx, app/portal/invite-notices.ts; invite email → /login?next=/portal.
- Evidence (local stack, 6c54016): `pnpm verify` 1473/1473 + strict build; pgTAP 198/198 (company_member_accept: invitee self-activate/delete filtered, AAL2 admin and anon activation 42501 from the trigger, service role accept/decline); walkthrough 8/8 incl. real magic link via /auth/callback?code (amr magiclink) and a refused password session (amr password). Post-step-up landing NOT WALKED (TOTP off locally).
- Receipt: `runs/20261104-124711/receipt.md`. Follow-ups D53, D54 (renumbered from D52, D53 in fix run 20261104-180420); D48-D50 held.

## 2026-11-04 PR #329 fix run 20261104-180420
- Rounds 1-4. Verifier: r1 VERIFIED on the named repros, then a review found H-A/H-B; r2 NOT VERIFIED (H-B3); r3 NOT VERIFIED (H-B4: a password change clears email_change_sent_at); r4 VERIFIED on 421003f (verifier-r4.md: H-B4 x3, creation-slack, B5g, G1a, G1b, H-B, H-B3, R1.2, R2a, R2b and a double-click Accept all refused or correct; L1, L2, L5 and L6 pass).
- Gate on the rebased head: pnpm verify 1627/1627 plus strict build; supabase test db 289/289 (8 files, including #328's).
- Lesson candidate: GoTrue fields that look like history (email_change_sent_at, recovery_sent_at) are mutable state that other user calls reset; prove mailbox ownership from signals the user cannot rewrite (email identity created_at/updated_at) and measure every creation path before choosing a tolerance.
