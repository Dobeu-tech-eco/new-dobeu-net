# End state: new-dobeu-net

- rounds: 1 resumed consolidation round; earlier rounds retained in conversation
- clarity: 90
- threshold: 80
- thresholdSource: default
- roster: claude, codex, copilot, gemini, grok, muse
- status: approved
- continuedAnyway: no
- sectionMap: approved by Jeremy in this conversation on 2026-10-22

## Deploy

```yaml
deploy:
  provider: vercel
  productionUrl: https://dobeu.net
  checkCommand: vercel ls --prod
```

Existing production target; no new deployment is requested. Local changes are not deployed. Authenticated/live service verification remains separate from local build evidence.

## Related repos

None. User decision: no other repos matter for this build. Portfolio links and read-only biographical research do not add linked repositories.

## Other harnesses

| folder | decision |
|---|---|
| .omc/ | coexist |
| .impeccable/ | coexist |
| .agent/ | import, read-only |
| .omx/, .codex/, .cursor/ | preserve; no migration requested |

Canonical AGENTS.md and CLAUDE.md remain intact except the setup skill's permitted managed pointer block. Do not edit upstream DTS2 plugin files.

## Skills

| skill | source | installed | serves component | phase | order |
|---|---|---|---|---|---|
| new-dobeu-net-conventions | project .agents/skills/new-dobeu-net | yes | all | build | 1 |
| impeccable | project .agents/skills/impeccable | yes | P1/P2 UI, when changed | review | 1 |
| loop-me | npx skills add https://github.com/mattpocock/skills --skill loop-me | yes | harness | plan | 1 |
| grill-me | npx skills add https://github.com/mattpocock/skills --skill grill-me | yes | harness | plan | 2 |
| grilling | npx skills add https://github.com/mattpocock/skills --skill grilling | yes | harness | plan | 3 |

Use existing project skills; no additional optional component skills proposed. Architecture and agent-writing companion steps remain ahead in setup.

## Topology

One Next.js 16 App Router application, React 19, Node 24, pnpm 10.34.1. The root package manager policy file does not make this a multi-package monorepo. A separate OCI service lives in the same repository.

- P1 Public site and projects: positioning, product showcase, public pages and metadata.
- P2 Collaboration intake: idea form, personal conversation/booking, optional detailed intake, delivery receipts.
- P3 Authentication, company and portal: identity, membership, user-owned projects/files/assets/work orders and settings.
- P4 Admin operations: authorized management and intake review.
- P5 Billing and integrations: Stripe invoicing, signed callbacks and external service boundaries.
- P6 Platform and verification: database/infrastructure checks, jobs, observability, tests, docs and harness.

These names normalize the six existing component groups without adding product scope.

## Blueprint

| layer | choice | status |
|---|---|---|
| data model | Existing Supabase schema, additive migrations, RLS; generated types only through approved generator | built |
| api surface | Existing Next route handlers and server actions; validate payloads and authorization | built |
| screens/routes | Existing public, company, portal and admin screens; retained product repositioning | built |
| auth | Existing Supabase sessions, ownership checks and admin/MFA guards; no redesign | built |
| infra/deploy | Existing Vercel web and OCI configuration, Node 24 and pnpm 10 | built |
| observability | Existing consent-gated analytics and Datadog; verify configuration separately | built |
| background jobs | Existing cleanup and invoice-aging handlers; scheduling/live execution not inferred from files | built |

Built means code exists, not that live verification passed.

## Sections

The 66-row map is approved.

- Status records reconciliation and acceptance. Keep each row `todo` until its evidence is attached and reviewed.
- Use existing code and historical tests as inputs; the table does not commission rewrites.
- Dependency ranges are inclusive.
- Section 65 closes after all evidence. Preparing these documents is a setup prerequisite, not product implementation.

| # | section | serves component | files / area | depends on | complexity | status |
|---|---|---|---|---|---|---|
| 1 | Database schema and policies | P3/P4/P5 | `supabase/migrations/; lib/database.types.ts` | - | design | todo |
| 2 | Database clients | P3/P4/P5 | `lib/supabase/` | 1 | normal | todo |
| 3 | Authentication and access guards | P3 | `middleware.ts; lib/actions/auth.ts; lib/actions/company-auth.ts; lib/supabase/middleware.ts; app/auth/callback/` | 2 | design | todo |
| 4 | Server actions and ownership checks | P3/P4/P5 | `lib/actions/` | 1,2,3 | design | todo |
| 5 | Collaboration submissions | P2 | `app/api/lead/; lib/leads.ts` | 2 | normal | todo |
| 6 | Booking and detailed intake | P2 | `app/api/webhooks/calendly/; app/api/typeform/webhook/` | 2,5 | normal | todo |
| 7 | Invoicing and payment events | P5 | `lib/invoice-creation.ts; app/api/webhooks/stripe/` | 2,3,4 | design | todo |
| 8 | Authorized file downloads | P3 | `app/api/assets/[id]/download/; app/api/files/[id]/download/` | 3,4 | design | todo |
| 9 | Curated repository showcase APIs | P1 | `app/api/github-activity/; app/api/github-repo/` | - | normal | todo |
| 10 | Internal administrative tooling | P4 | `app/api/agent/; lib/agent/` | 3 | normal | todo |
| 11 | Scheduled maintenance | P6 | `app/api/cron/cleanup/; app/api/cron/invoice-aging/` | 2,7 | normal | todo |
| 12 | Consent and observability | P6 | `lib/analytics.ts; lib/datadog.ts; hooks/use-cookie-consent.ts` | - | normal | todo |
| 13 | Public identity and project data | P1 | `lib/jeremy-data.ts; lib/marketing-schema.ts` | - | normal | todo |
| 14 | Shared public interface | P1/P2 | `components/landing/` | 5,6,12,13 | design | todo |
| 15 | Shared authenticated interface | P3/P4 | `components/portal/; components/admin/; authenticated layouts` | 3,4 | normal | todo |
| 16 | Hosting and container service | P6 | `next.config.ts; vercel.json; containers/function/` | - | normal | todo |
| 17 | CI and security checks | P6 | `.github/workflows/` | 16 | normal | todo |
| 18 | Homepage | P1 | `app/page.tsx` | 13,14 | normal | todo |
| 19 | About | P1 | `app/about/page.tsx` | 13,14 | normal | todo |
| 20 | Services overview | P1 | `app/services/page.tsx` | 13,14 | normal | todo |
| 21 | Service details | P1 | `app/services/[pillar]/page.tsx` | 20 | normal | todo |
| 22 | Process | P1 | `app/process/page.tsx` | 13,14 | normal | todo |
| 23 | Optional paid-build pricing | P1 | `app/pricing/page.tsx` | 13,14 | normal | todo |
| 24 | Website package | P1 | `app/website-package/page.tsx` (retired → redirect to /) | 13,14 | normal | done |
| 25 | Project examples | P1 | `app/case-studies/page.tsx` | 13,14 | normal | todo |
| 26 | Project detail | P1 | `app/case-studies/[slug]/page.tsx` | 25 | normal | todo |
| 27 | Labs | P1 | `app/labs/page.tsx; components/labs/` | 14 | normal | todo |
| 28 | Repository viewer | P1 | `app/repos/page.tsx` | 9,14 | normal | todo |
| 29 | Privacy | P1 | `app/privacy/page.tsx` | 14 | normal | todo |
| 30 | Terms | P1 | `app/terms/page.tsx` | 14 | normal | todo |
| 31 | Cookies | P1 | `app/cookies/page.tsx` | 12,14 | normal | todo |
| 32 | Marketing opt-out | P1 | `app/marketing-opt-out/page.tsx` | 12,14 | normal | todo |
| 33 | SMS opt-in | P1 | `app/optin/sms/page.tsx` | 14 | normal | todo |
| 34 | Login | P3 | `app/login/page.tsx` | 3 | normal | todo |
| 35 | Company overview | P3 | `app/company/page.tsx` | 3,4,15 | normal | todo |
| 36 | Company members | P3 | `app/company/members/page.tsx` | 35 | normal | todo |
| 37 | Portal dashboard | P3 | `app/portal/page.tsx` | 3,4,15 | normal | todo |
| 38 | Portal projects | P3 | `app/portal/projects/page.tsx` | 37 | normal | todo |
| 39 | Portal project detail | P3 | `app/portal/projects/[id]/page.tsx` | 38 | normal | todo |
| 40 | Portal files | P3 | `app/portal/files/page.tsx` | 8,37 | normal | todo |
| 41 | Portal assets | P3 | `app/portal/assets/page.tsx` | 8,37 | normal | todo |
| 42 | Portal invoices | P3/P5 | `app/portal/invoices/page.tsx` | 7,37 | normal | todo |
| 43 | Portal work orders | P3 | `app/portal/tickets/page.tsx` | 4,37 | normal | todo |
| 44 | Portal work-order detail | P3 | `app/portal/tickets/[id]/page.tsx` | 43 | normal | todo |
| 45 | Portal settings | P3 | `app/portal/settings/page.tsx` | 3,4,37 | normal | todo |
| 46 | MFA settings | P3 | `app/portal/settings/mfa/page.tsx` | 3,45 | normal | todo |
| 47 | Admin dashboard | P4 | `app/admin/page.tsx` | 3,4,15 | normal | todo |
| 48 | Admin analytics | P4 | `app/admin/analytics/page.tsx` | 12,47 | normal | todo |
| 49 | Admin bookings | P4 | `app/admin/bookings/page.tsx` | 6,47 | normal | todo |
| 50 | Admin companies | P4 | `app/admin/companies/page.tsx` | 4,47 | normal | todo |
| 51 | Admin company detail | P4 | `app/admin/companies/[id]/page.tsx` | 50 | normal | todo |
| 52 | Admin intake list | P4 | `app/admin/intakes/page.tsx` | 6,47 | normal | todo |
| 53 | Admin intake detail | P4 | `app/admin/intakes/[id]/page.tsx` | 52 | normal | todo |
| 54 | Admin invoices | P4/P5 | `app/admin/invoices/page.tsx` | 7,47 | normal | todo |
| 55 | Admin leads | P4 | `app/admin/leads/page.tsx` | 5,47 | normal | todo |
| 56 | Admin projects | P4 | `app/admin/projects/page.tsx` | 4,47 | normal | todo |
| 57 | Admin project detail | P4 | `app/admin/projects/[id]/page.tsx` | 56 | normal | todo |
| 58 | Admin work orders | P4 | `app/admin/tickets/page.tsx` | 4,47 | normal | todo |
| 59 | Admin work-order detail | P4 | `app/admin/tickets/[id]/page.tsx` | 58 | normal | todo |
| 60 | Admin users | P4 | `app/admin/users/page.tsx` | 4,47 | normal | todo |
| 61 | Admin user detail | P4 | `app/admin/users/[id]/page.tsx` | 60 | normal | todo |
| 62 | Unit, integration and type checks | P6 | `colocated tests; vitest.config.ts; tsconfig.json` | 1-61,66 | normal | todo |
| 63 | Browser and visual verification | P6 | `e2e/; playwright.config.ts` | 18-61,66 | normal | todo |
| 64 | Accessibility and performance | P6 | `lighthouserc*; browser checks` | 18-61,66 | normal | todo |
| 65 | Documentation and harness completion | P6 | `docs/; .harness/; .claude/dts2-harness.local.md` | 1-64,66 | normal | todo |
| 66 | Public metadata and discoverability | P1 | `app/layout.tsx; app/opengraph-image.tsx; app/sitemap.ts; app/robots.ts; public/llms.txt` | 13,18-33 | normal | todo |

## Goal

Finish the repository harness and plan the closeout of the existing application.

1. Preserve “We build usable business technology,” real product examples, personal collaboration invitations and Jeremy's deliberately vague bio.
2. Reconcile old roadmap claims against current source and tests before commissioning further work.

## Constraints

- Preserve all pre-existing tracked and untracked changes. No stash, reset, deletion, commit, push or deployment is implied.
- Keep the work in this repository. Coexisting tooling and imported plans remain read-only.
- Preserve current auth, ownership, consent, billing, durable lead acceptance, webhook verification and persisted identifiers. Any proposed behavioral change gets its own explicit scope.
- No secrets in prompts, logs, documents or output. Presence checks only; no external side effects for verification without authority.
- Keep Jeremy's public bio intentionally broad: curiosity, passion projects, useful things and like-minded collaboration. No career specifics, by-night framing, personal location, private repository names, inferred credentials or metrics.
- Public positioning excludes AI/agent/consulting promotion. Existing internal identifiers/tooling are not erased merely because their names contain those terms.
- Retain RouteReady, Chima Comics, Dobeu.space and Ikram & Co. links; do not edit those separate properties.
- No new dependencies or broad refactors. Config changes must have a reviewable diff before application.
- Use execution-tier builders; frontier models are advisory/sign-off only. One writer per file.

## Non-goals

- New product features, native apps, additional repositories or background-job programs.
- Production configuration changes, migrations, messages/emails, real payments, releases or account setup.
- Publishing private source code or private project details.
- Replacing existing authentication, billing providers, tooling or historical plans.

## Acceptance criteria

### P1 Public site and projects
- [x] Exact business-technology heading and links to RouteReady, Chima Comics, Dobeu.space and Ikram & Co. retained; browser checks pass on desktop/mobile.
- [ ] Public visible text, metadata and accessible labels pass the existing forbidden-positioning audit, including dynamic GitHub event response/display text; route tests verify filtering and rejection contracts.
- [x] Founder remains intentionally vague; primary invitation is collaboration, with no unsupported bio claims.

### P2 Collaboration intake
- [x] Primary CTA opens the idea form; booking and email paths remain distinct and usable.
- [x] Existing lead payload, durable acceptance, success/failure behavior and consent are preserved by tests.
- [x] External delivery/booking tests are either independently evidenced or listed as unverified; no live submissions implied.

### P3 Authentication, company and portal
- [ ] Each route has source/test evidence for its access boundary; no unauthenticated or cross-owner access introduced.
- [ ] Existing portal/company flows remain compatible; any skipped backend-dependent checks are explicitly recorded.
- [ ] Generated database types and persisted identifiers are preserved.

### P4 Admin operations
- [ ] Admin screens/actions retain existing authorization and MFA requirements, backed by relevant tests/source review.
- [ ] Detailed intake remains review-only; no automatic pricing or unapproved external action is introduced.

### P5 Billing and integrations
- [ ] Existing signed-webhook and idempotency behavior remains intact under relevant tests.
- [ ] Every provider verification is labeled local/mock, read-only remote, or live side effect; unavailable evidence stays open.
- [ ] No real payment, invoice dispatch or provider configuration mutation occurs during this plan finalization.

### P6 Platform and verification
- [ ] Harness config matches actual stack and scripts; approved roster and protected paths resolve correctly.
- [ ] Required discipline/state/keep/action-items/local-settings/memory-pointer files exist without replacing unrelated guidance.
- [ ] All 66 sections have evidence, dependency/ownership mapping and honest done/todo/blocked states; all seven blueprint layers are covered.
- [x] `pnpm verify`, scoped browser checks and applicable visual checks have fresh recorded results for the resulting tree; warnings and skipped checks are explicit.
- [ ] Architecture and agent-writing passes complete through their setup approval gates; run plan includes nonempty Done criteria and disjoint owned paths.
- [x] Receipt and handoff distinguish local completion from outstanding live-service work and production approval.

## Assumptions

- Continuing this task means preserving and building on the current uncommitted work; it does not grant commit or deployment authority.
- Prior claims that features shipped or config is missing may be stale; source and current evidence take precedence.
- Existing tests can verify local contracts, but cannot establish provider configuration or production behavior.
- The read-only scaffold scout reported tier M, two prospective builders, correctness/security review. Final seats depend on current probes and actual plan reach.
- Approved agent roster: Claude, Codex, Copilot, Gemini, Grok, Muse. Subscription confirmations are retained; current availability still requires a probe. Cursor is not authenticated and was not added.

## Open questions

- End-state content, architecture amendments and form-only wording pass are approved in this conversation.
- Existing config will be merged, not replaced, if the accompanying proposed diff is approved.
- Live-service gaps need current evidence. Do not turn historical env lists into assertions that keys are currently missing.
- Worktree handling must preserve the dirty baseline: choose an isolated copy of the baseline or an explicitly approved shared-tree exception before builders. Do not silently omit uncommitted work from child checkouts.
- Completed setup wording and architecture checkpoints authorize no additional feature changes.

## Accepted evidence — run 20261022-172443

Ship accepted on 2026-10-23. Evidence: `runs/20261022-172443/receipt.md`, `final-verification.md`, `walkthrough.md`, and `v0.md`. P1/P2 scoped rebrand closeout and P6 local verification/receipt are accepted. Local/mock only: 696 tests, 50 positioning checks, 8 schema routes, 6 dialog walkthroughs and strict build passed. Booking means the local fallback; external Calendly remains unverified.

Per the approved run plan, broad section rows remain `todo`: this narrow patch does not establish full acceptance of those sections. Sections 14,18,19,22,25 have accepted scoped change evidence; sections 1,2,5,6,12,13 have verification-only evidence. Section 24's offer and section 14's disclosure are deferred decisions. No DB/RLS, provider or production completion is inferred.
