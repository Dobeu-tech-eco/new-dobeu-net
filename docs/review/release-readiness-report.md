# Release Readiness Report

Date: 2026-05-23  
Branch: `test/coverage`

## Decision

**NO-GO** for DNS cutover right now.

## Why

1. Mobile Lighthouse performance gate is not met.
   - Target: >= 90
   - Current: **78** (`docs/review/lighthouse-mobile.json`)
2. Composio-side external integration verification could not be executed in this session because the Composio MCP server is unavailable.

## What is complete

- Branch rebased and CLAUDE/pointer docs synced.
- Critical blockers closed:
  - open redirect fix
  - file download route
  - Typeform webhook + signature verification
  - bookings mirror + admin bookings visibility
  - schema-drift resilience for lead writes
- Consent and analytics hardening closed:
  - GTM/GA/Vercel analytics now load only post-consent
  - dataLayer events verified post-consent (`cta_click`, `booking_started`, `lead_submitted`)
  - lead form no longer forwards email/name PII to analytics payloads
- Hardening and CI closed:
  - Upstash rate limiting support for `/api/lead`
  - Apollo de-dup search/patch path
  - `/admin/users/[id]` detail page stub added
  - CI now includes `pnpm test:ci`
- Quality gates:
  - `pnpm verify` pass
  - `pnpm test:e2e` pass (17/17)

## Retest criteria for GO

1. Improve mobile performance score to >= 90 and re-run Lighthouse with artifact update.
2. Run Composio-backed third-party integration checks once Composio MCP is available, and append results to `docs/review/live-test-evidence.md`.
3. Re-run `pnpm verify` and `pnpm test:e2e` after any perf or integration changes.
