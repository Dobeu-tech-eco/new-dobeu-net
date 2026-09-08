---
title: Frontend Visual Refresh and Labs Showcase - Plan
date: 2026-08-29
type: feat
topic: frontend-visual-labs
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
product_contract_preservation: restructured after ce-doc-review — no scope change; added AE6–AE8, R8 interim rule, phasing, performance co-scope note
execution: code
---

# Frontend Visual Refresh and Labs Showcase - Plan

## Goal Capsule

**Objective:** Deliver a distinctive Immersive Canvas landing experience on `/`, a portfolio-first `/labs` showcase page with one rotating experiment slot, an automated visual-regression suite, and a hard CI gate for mobile Lighthouse Performance ≥90 on `/` (and `/labs` once it ships).

**Product authority:** This plan owns the public marketing landing visual identity, the new `/labs` surface, and the quality-gate infrastructure (visual regression + Lighthouse CI) required to ship those changes safely. Portal, admin, and `/repos` are not active scope.

**Open blockers:** None for planning. First rotating experiment content is deferred to planning/implementation (the slot mechanism is in scope; the specific demo is not).

## Product Contract

### Summary

Redesign the landing hero and first-impression flow using an Immersive Canvas pattern (full-viewport atmosphere, floating capability cards, clear path into deeper exploration). Add a `/labs` page that showcases curated interactive demos from real shipped work plus one swappable experiment slot. Ship automated visual-regression tests and enforce mobile Lighthouse Performance ≥90 as a hard gate in CI before merge.

### Problem Frame

Visitors currently land on a page that has functional hero components (shader background, typewriter, GitHub activity) but lacks a cohesive, memorable first impression. The founder identified the hero/landing identity as the biggest gap. Separately, the repo has smoke E2E tests and a documented mobile Lighthouse score of ~78, but neither visual regression nor Lighthouse enforcement exists in CI — making visual polish risky to ship and impossible to gate objectively.

### Key Decisions

- **Immersive Canvas hero** (session-settled: user-directed — chosen over Split Command Center and Editorial Studio layouts: maximum first-impression impact for the stated identity gap). Governs R1, R2.

- **Portfolio theater + one experiment slot for `/labs`** (session-settled: user-approved — chosen over pure R&D playground: conversion value with manageable carrying cost). Governs R3, R4.

- **Landing-first delivery** — Phase A (hero + `/` gates) may merge independently; Phase B (`/labs` + R8 CTA visibility) ships after `/labs` satisfies AE2. `/labs` demos echo patterns already live on the landing. Governs R1, R3, F2, R8.

- **Hard quality gates in scope** — visual regression and mobile Lighthouse ≥90 are deliverables, not post-launch follow-ups. Governs R5, R6, R7.

- **Mobile Lighthouse Performance only as hard gate** — Accessibility, Best Practices, and SEO remain informational targets per existing project norms unless a future plan elevates them. Governs R6.

### Requirements

**Landing visual identity**

- R1. The `/` hero uses an Immersive Canvas layout: full-viewport atmospheric background, dominant centered headline, floating capability cards representing core service areas, a **primary CTA** that opens the booking lightbox, and a **secondary CTA** that routes to `/labs` (R8).
- R2. The landing page below the hero gains enough visual cohesion (nav, section rhythm, typography hierarchy, motion discipline) that the full scroll experience feels intentional and distinct — not a collection of unrelated sections. Hero + nav + CTA flow are mandatory; full section-by-section redesign of Services, HowItWorks, Founder, and FAQ is optional polish within this plan.
- R2a. All motion and shader effects respect `prefers-reduced-motion` and degrade gracefully when WebGL is unavailable, consistent with existing `use-motion-props` and `HeroShaderBackground` patterns.

**Labs showcase**

- R3. A public `/labs` route exists as a portfolio theater: 3–4 curated interactive demos drawn from real shipped work (e.g., agent loop, shader/visual effects, lead pipeline, growth tooling) that prove technical craft beyond what `/repos` lists.
- R4. `/labs` includes exactly one rotating "featured experiment" slot — a swappable surface for cutting-edge UI techniques being tested before they land on the main site. The slot mechanism is in scope; the first experiment's specific content is chosen during implementation.
- R4a. Every demo and the experiment slot end with a conversion bridge ("Want this for your product?") routing to book-a-call or lead-form CTAs.

**Quality gates**

- R5. An automated visual-regression suite captures baseline snapshots for `/` at desktop and mobile viewports (via a dedicated mobile Playwright project), and for `/labs` once it exists. CI fails when snapshots diverge beyond an approved threshold without an intentional baseline update. Snapshots use animation-disabled or masked regions for shader canvas, typewriter, and dynamic ticker content to limit flake.
- R6. CI enforces mobile Lighthouse Performance ≥90 on `/` as a hard ship gate. Once `/labs` ships, the same threshold applies to `/labs`.
- R7. Playwright E2E smoke tests pass in CI on desktop and mobile viewport projects, including fixes for any stale assertions (e.g., title mismatches between `e2e/smoke.spec.ts` and current page metadata).

**Integration**

- R8. The landing hero's secondary CTA ("Explore the lab →" or equivalent) routes to `/labs`. The secondary CTA is hidden until `/labs` satisfies AE2 (landing-first); it must not ship as a dead link.
- R9. `/labs` complements `/repos` — it does not replace GitHub listings with interactive proof.

### Key Flows

- F1. **First visit:** Visitor lands on `/` → immersive hero loads with capability cards → primary CTA opens booking lightbox OR secondary CTA navigates to `/labs`.
- F2. **Labs exploration:** Visitor opens `/labs` → browses curated demos → interacts with at least one demo → conversion bridge prompts booking/form.
- F3. **CI gate:** Developer opens PR with visual changes → CI runs visual-regression diff + mobile Lighthouse on `/`. Once `/labs` ships, CI always runs mobile Lighthouse on `/labs` on every PR (not path-filtered). Merge blocked if snapshots fail or Performance < 90.

### Acceptance Examples

- AE1. When a visitor has `prefers-reduced-motion: reduce` enabled, the hero and landing sections render fully visible content without opacity-0 traps or animation-dependent readability. Covers R2a.

- AE2. When `/labs` loads, at least three curated demos are interactive (not static screenshots) and one experiment slot is present (populated or explicitly marked as coming soon with a mechanism to swap content). Covers R3, R4.

- AE3. When a PR changes hero or `/labs` layout without updating visual-regression baselines, CI fails with a clear snapshot diff. Covers R5.

- AE4. When mobile Lighthouse Performance on `/` scores below 90, CI fails with the measured score and category breakdown. Covers R6.

- AE5. When `pnpm test:e2e` runs in CI, all smoke tests pass including homepage title and hero CTA assertions aligned to current metadata. Covers R7.

- AE6. When mobile Lighthouse Performance on `/labs` scores below 90 (after `/labs` ships), CI fails with the measured score and category breakdown. Covers R6.

- AE7. When a visitor clicks the hero secondary CTA (once visible per R8), they navigate to `/labs`. Covers R8.

- AE8. Each curated demo and the experiment slot on `/labs` render a conversion bridge CTA routing to book-a-call or lead-form. Covers R4a.

### Success Criteria

- A first-time visitor can describe what Dobeu does within 5 seconds of landing (qualitative — validated via manual walkthrough).
- Mobile Lighthouse Performance ≥90 on `/` verified in CI artifact, up from the documented ~78 baseline.
- Visual-regression suite covers landing at mobile + desktop viewports with zero unintended diffs on green builds.
- `/labs` receives traffic from the hero CTA and demonstrates at least one technique not visible on the current landing.

### Scope Boundaries

**In scope:** `/` hero and landing cohesion, `/labs` showcase page, visual-regression infrastructure, Lighthouse CI gate, E2E smoke fixes, mobile Playwright viewport project.

**Deferred for later:**

- Portal and admin visual overhaul.
- Full section-by-section redesign of every landing section (optional within R2).
- Accessibility / Best Practices / SEO as hard CI gates (remain informational).
- Real social proof re-enable (`Proof.tsx`) — blocked on attributable quotes per brand rule.
- `ce-optimize` experiment loop for iterative perf tuning (recommended follow-up once Lighthouse harness exists).

**Outside this product's identity:**

- Fabricated testimonials or unverifiable statistics.
- Pure R&D playground with no portfolio or conversion purpose.
- Replacing `/repos`.

### Dependencies / Assumptions

- **Assumption:** Primary success signal is stronger first impression and lab engagement leading to bookings; no explicit analytics target was set in brainstorm.
- **Assumption:** Visual-regression baselines are captured after the new hero design lands (or refreshed in a deliberate two-phase pass: ship hero → update baselines).
- **Dependency:** CI workflow expansion beyond current `pnpm verify` (which runs type-check, lint, vitest, build only).
- **Dependency:** Playwright already installed; `@lhci/cli` or equivalent needed for Lighthouse automation.
- **Existing patterns to extend:** `motion/react` + `use-motion-props`, `HeroShaderBackground`, `LightboxProvider`, design tokens in `globals.css` / `tailwind.config.ts`.
- **Current gaps (from infrastructure review):** E2E smoke test failing on stale title assertion; no visual snapshots; no Lighthouse CI; Playwright desktop-only project.
- **Performance risk:** Immersive Canvas may conflict with mobile Lighthouse ≥90; optimization work (script deferral, LCP headline SSR, shader mobile fallback) is co-scoped with R1, not deferred to a follow-up.

### Outstanding Questions

- **Deferred to Planning:** Capability card interaction model (decorative vs. scroll-to-section vs. `/labs` deep-link); ActivityTicker/typewriter retention in new hero; `/labs` demo presentation pattern (inline vs. modal); experiment slot swap mechanism (build-time config vs. CMS); Lighthouse/visual CI theme matrix (light only vs. both).
- **Resolve Before Planning:** None — phasing and R8 interim rule resolved in Key Decisions above.

<!-- ce-section: work-relationships -->

### How This Work Fits Together

This plan owns the public-facing visual identity upgrade and its quality gates. Broader product work remains contextual:

- **Landing conversion pack** (from `PLAN.md`) — Shares lead-form and CTA surfaces; this plan improves the visual path into those conversions but does not own CRM or social-proof content.
- **Portal / admin surfaces** — Can proceed independently; no dependency on this work.
- **Post-launch automations** (Lighthouse reporting, digests) — Enables future monitoring once the hard gate exists here.

## Planning Contract

### Sequencing

Delivery is split into three phases. Phase 0 (quality infrastructure) can land first on the current UI to establish green gates before visual work intensifies.

| Phase | Focus | Merge gate |
|-------|-------|------------|
| **0 — Gates** | E2E CI, visual regression harness, Lighthouse CI | Smoke + snapshot + LHCI green on current `/` |
| **A — Landing** | Immersive Canvas hero + cohesion pass + perf budget | `/` visual-regression + mobile Lighthouse ≥90 |
| **B — Labs** | `/labs` page, demos, experiment slot, R8 CTA reveal | AE2 + `/labs` Lighthouse + snapshots |

### Key Technical Decisions

- **KTD1 — Playwright projects: desktop + mobile** — Add `Pixel 5` (or equivalent) project alongside Desktop Chrome for smoke and visual tests. Governs R5, R7.

- **KTD2 — Visual regression via Playwright `toHaveScreenshot`** — Use built-in snapshots (no Percy/Chromatic) with `maxDiffPixelRatio`, masks for shader canvas / ActivityTicker / typewriter, and `animations: 'disabled'` in visual specs. Capture light theme first; dark theme baselines added in U3 if time permits. Governs R5.

- **KTD3 — Lighthouse CI on production build** — Run `@lhci/cli` against `pnpm build && pnpm start` (not `pnpm dev`), mobile form factor, `numberOfRuns: 3` median, assert `categories:performance >= 0.9`. Store config in `lighthouserc.js`. Governs R6.

- **KTD4 — CI job split** — Keep `pnpm verify` fast; add separate `e2e` and `lighthouse` jobs in `.github/workflows/ci.yml` (or `quality-gates.yml`). Governs R5, R6, R7.

- **KTD5 — Hero content model** — Retain ActivityTicker and typewriter in Immersive Canvas (social proof + craft signal). Capability cards scroll to `#work` sections on tap; they are interactive, not decorative. Primary CTA = "Book a call" (lightbox); secondary = "Explore the lab →" (hidden until Phase B). Governs R1, R8, F1.

- **KTD6 — Mobile shader fallback** — On mobile viewports, use static gradient fallback (extend `HeroShaderBackground` pattern) when WebGL unavailable or `prefers-reduced-motion`; reduces LCP risk for R6. Governs R1, R2a, R6.

- **KTD7 — `/labs` demo pattern** — Card grid landing; each demo expands inline (accordion/expand panel), not full-screen modal. Demos use sandboxed/mocked data — no live API keys on public page. Experiment slot driven by `lib/labs-data.ts` config array (build-time swap). Governs R3, R4.

- **KTD8 — Perf co-scope** — Before locking hero visuals, run Lighthouse on prod build and address top LCP wins: defer non-critical analytics scripts, ensure hero `h1` is SSR-visible without opacity trap, lazy-load below-fold capability card motion. Governs R6, R1.

### Assumptions (resolved from Outstanding Questions)

- Capability cards: tap scrolls to `#work` service section matching card label.
- ActivityTicker + typewriter: retained in new hero layout.
- `/labs` demos: inline expand panels with mocked interactivity.
- Experiment slot: `lib/labs-data.ts` featured experiment entry; "coming soon" is valid shipped state per AE2.
- Visual/Lighthouse CI theme: light mode only for v1 baselines.

## Implementation Units

### U1. Fix E2E smoke and add mobile Playwright project

**Goal:** Green smoke tests on desktop + mobile; CI-ready Playwright config. Covers R7.

**Files:**
- `e2e/smoke.spec.ts` — fix title assertion to match `app/page.tsx` metadata (`/Jeremy Williams/i`)
- `playwright.config.ts` — add `mobile-chrome` project (`devices['Pixel 5']`)
- `.github/workflows/ci.yml` — add `e2e` job: `pnpm exec playwright install --with-deps chromium`, `pnpm test:e2e`

**Approach:** Align smoke assertions to current hero CTAs ("Book a call" remains). Tag env-dependent `e2e/tickets.spec.ts` to skip without Supabase (already skipped).

**Test scenarios:**
- Homepage loads with correct title on desktop and mobile
- Hero book CTA opens lightbox dialog
- `/portal` and `/admin` auth redirects still pass

**Depends on:** none

### U2. Visual regression harness

**Goal:** Snapshot baselines for `/` at desktop + mobile with flake controls. Covers R5, AE3.

**Files:**
- `e2e/visual/landing.spec.ts` (new) — `toHaveScreenshot` for hero above-fold and full page
- `playwright.config.ts` — snapshot path template, `expect` timeout, `animations: 'disabled'`
- `e2e/visual/landing.spec.ts-snapshots/` (generated baselines)

**Approach:** Mask `[data-testid="hero-shader"]`, ActivityTicker, typewriter regions. Wait for `document.fonts.ready`. Run against `pnpm build && pnpm start` in CI (update `webServer` for visual job or use separate config).

**Test scenarios:**
- Desktop hero snapshot matches baseline
- Mobile hero snapshot matches baseline
- Intentional layout change without baseline update fails CI

**Depends on:** U1

### U3. Lighthouse CI gate

**Goal:** Hard mobile Performance ≥90 gate on `/` in CI. Covers R6, AE4.

**Files:**
- `lighthouserc.js` (new) — mobile preset, assert performance ≥ 0.9, 3 runs
- `package.json` — add `@lhci/cli` devDep, `lighthouse:ci` script
- `.github/workflows/ci.yml` — `lighthouse` job after build

**Approach:** Run LHCI against production server. Upload report artifact. Document baseline refresh in plan Verification Contract.

**Test scenarios:**
- CI fails when performance score < 90 (verify with temporary threshold breach in branch)
- CI passes when score ≥ 90 on optimized build

**Depends on:** U1 (CI job pattern); U8 perf work for green score

### U4. Immersive Canvas hero redesign

**Goal:** Replace current hero layout with Option B Immersive Canvas. Covers R1, R2a, R8 (CTA markup only — hidden until Phase B).

**Files:**
- `components/landing/Hero.tsx` — restructure layout: centered headline, floating capability cards, dual CTAs
- `components/landing/HeroShaderBackground.tsx` — mobile static fallback per KTD6
- `lib/jeremy-data.ts` — capability card labels mapped to `#work` anchors
- `app/page.tsx` — if metadata title should unify with brand ("Ship the agent…") decide here

**Approach:** Extend existing motion/shader patterns. Secondary CTA rendered but `hidden` until Phase B flag/env. Cards use `scrollIntoView` to service sections.

**Test scenarios:**
- AE1: reduced-motion renders visible content immediately
- Primary CTA opens booking lightbox
- Capability card click scrolls to matching service section
- AE7 deferred until U7 enables secondary CTA

**Depends on:** U2 baselines captured after hero lands (two-step: ship hero → update snapshots)

### U5. Landing cohesion pass

**Goal:** Nav, section rhythm, typography hierarchy feel intentional. Covers R2.

**Files:**
- `components/landing/SiteNav.tsx` — elevated scroll state, spacing tokens
- `components/landing/Services.tsx`, `HowItWorks.tsx`, `FinalCTA.tsx` — spacing/typography token alignment (not full redesign)
- `app/globals.css` — section spacing utilities if needed

**Approach:** Token-level cohesion only — no wholesale section rewrites unless time permits.

**Test scenarios:**
- Visual regression full-page snapshot still passes after cohesion edits
- Theme toggle works in light and dark

**Depends on:** U4

### U6. `/labs` route and layout scaffold

**Goal:** Public `/labs` page with card grid shell. Covers R3 (structure).

**Files:**
- `app/labs/page.tsx` (new)
- `components/labs/LabsPage.tsx` (new)
- `components/labs/DemoCard.tsx` (new)
- `lib/labs-data.ts` (new) — demo metadata + experiment slot config

**Approach:** Server component page with client demo panels. Metadata + OG image. Add `/labs` to sitemap.

**Test scenarios:**
- `/labs` returns 200
- Page renders demo card grid (stubs acceptable initially)

**Depends on:** U4 (design tokens)

### U7. Curated demos + experiment slot

**Goal:** 3 interactive demos + 1 experiment slot with conversion bridges. Covers R3, R4, R4a, AE2, AE8.

**Files:**
- `components/labs/demos/` — `AgentLoopDemo.tsx`, `ShaderDemo.tsx`, `LeadPipelineDemo.tsx` (minimum 3)
- `components/labs/ExperimentSlot.tsx`
- `lib/labs-data.ts` — populate demo entries

**Approach:** Each demo is self-contained with mocked state. Experiment slot reads featured entry from `labs-data`. Conversion bridge uses existing `LightboxProvider`.

**Test scenarios:**
- AE2: ≥3 interactive demos + experiment slot visible
- AE8: each demo shows conversion CTA
- E2E: click secondary CTA from hero navigates to `/labs` (AE7)

**Depends on:** U6

### U8. Performance optimization for Lighthouse gate

**Goal:** Close 78→90 mobile Performance gap. Covers R6, KTD8.

**Files:**
- `app/layout.tsx` — audit `next/script` strategy for analytics (lazyOnload where possible)
- `components/landing/Hero.tsx` — SSR-visible headline, no opacity-0 LCP trap
- `components/landing/HeroShaderBackground.tsx` — mobile lightweight fallback
- `next.config.ts` — verify `optimizePackageImports` includes heavy deps

**Approach:** Re-run Lighthouse after each change; target LCP < 2.5s on mobile lab. Document score in `docs/review/lighthouse-mobile.json` refresh.

**Test scenarios:**
- AE4: CI Lighthouse job passes with score ≥ 90
- LCP element is hero headline without excessive render delay

**Depends on:** U3 (harness); parallel with U4–U5

### U9. Enable hero→labs CTA and extend gates to `/labs`

**Goal:** Reveal secondary CTA; add `/labs` snapshots + Lighthouse. Covers R8, AE6, AE7.

**Files:**
- `components/landing/Hero.tsx` — remove `hidden` from secondary CTA
- `e2e/visual/labs.spec.ts` (new)
- `lighthouserc.js` — add `/labs` URL
- `e2e/smoke.spec.ts` — add `/labs` navigation test

**Approach:** Ship only when U7 satisfies AE2. Extend visual + Lighthouse CI per F3.

**Test scenarios:**
- AE6: `/labs` Lighthouse ≥ 90 in CI
- AE7: secondary CTA navigates to `/labs`
- Visual snapshots for `/labs` desktop + mobile

**Depends on:** U7, U3, U2

## Verification Contract

```bash
# Fast gate (existing)
pnpm verify

# E2E smoke + visual regression
pnpm exec playwright install --with-deps chromium
pnpm test:e2e

# Lighthouse (local, matches CI)
pnpm build && pnpm start &
pnpm lighthouse:ci   # runs @lhci/cli via lighthouserc.js

# Manual walkthrough (required before Phase B ship)
# 1. Load / in light + dark, desktop + mobile
# 2. Verify reduced-motion: no invisible content
# 3. Load /labs, interact with each demo, click conversion CTA
# 4. Confirm /repos still works alongside /labs
```

**CI gates (all required on PR):**
- `verify` — type-check, lint, vitest, build:strict
- `e2e` — smoke + visual regression
- `lighthouse` — mobile Performance ≥90 on `/` (and `/labs` after U9)

## Definition of Done

**Global:**
- [ ] All implementation units U1–U9 complete per phase sequencing
- [ ] `pnpm verify` green
- [ ] E2E smoke + visual regression green in CI
- [ ] Mobile Lighthouse Performance ≥90 on `/` in CI artifact
- [ ] After Phase B: `/labs` meets AE2, AE6, AE7, AE8; secondary CTA visible
- [ ] No fabricated social proof added
- [ ] `CLAUDE.md` Lighthouse note updated from "informational" to reference CI gate for Performance (optional doc sync)

**Per phase:**
- **Phase 0:** U1–U3 merged; smoke test title fixed; CI jobs exist
- **Phase A:** U4–U5 + U8 merged; hero visual regression baselines committed; Lighthouse ≥90
- **Phase B:** U6–U7 + U9 merged; labs gates active; manual walkthrough recorded
