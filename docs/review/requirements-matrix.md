# Requirements Matrix

Date: 2026-05-23
Branch: `test/coverage`

## P0

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| C1 | Auth callback open redirect fixed | ✅ Closed | `app/auth/callback/route.ts`, `app/login/LoginForm.tsx`, `app/auth/callback/route.test.ts` |
| C2 | File download API route exists | ✅ Closed | `app/api/files/[id]/download/route.ts`, `app/api/files/[id]/download/route.test.ts` |
| C3 | Schema drift resilience | ✅ Closed (code fallback) | `lib/leads.ts` fallback table support (`leads`, `dobeu_net_leads`, `contact_submissions`) |
| C4b | Bookings admin no longer empty | ✅ Closed | `app/api/webhooks/calendly/route.ts` mirrors to `bookings`; admin pages fallback from `leads` source=book |
| C5 | Typeform webhook endpoint | ✅ Closed | `app/api/typeform/webhook/route.ts`, `lib/typeform.ts`, `app/api/typeform/webhook/route.test.ts` |

## P1

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| O1 | Vercel Analytics + Speed Insights consent-gated | ✅ Closed | `components/analytics-provider.tsx`, `app/layout.tsx` |
| GTM | GTM script/event flow consent-gated | ✅ Closed | `components/analytics-provider.tsx`, `lib/analytics.ts`, `components/landing/LeadForm.tsx`, `docs/review/live-test-evidence.md` |
| H1 | Replace in-memory lead rate limit with Upstash | ✅ Closed | `app/api/lead/route.ts`, deps: `@upstash/ratelimit`, `@upstash/redis` |
| H2 | Apollo de-dup search-then-patch path | ✅ Closed | `lib/apollo.ts` + updated tests in `lib/apollo.test.ts` |
| H4 | `/admin/users/[id]` no longer 404 | ✅ Closed | `app/admin/users/[id]/page.tsx` |
| CI-gap | CI runs unit tests | ✅ Closed | `.github/workflows/ci.yml` now includes `pnpm test:ci` |

## P2

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| E2E | Playwright config + smoke specs | ✅ Closed | `playwright.config.ts`, `e2e/smoke.spec.ts`, `pnpm test:e2e` pass |
| N5 | Lighthouse mobile performance ≥ 90 | ❌ Open | Current measured score: 78 (`docs/review/lighthouse-mobile.json`) |
