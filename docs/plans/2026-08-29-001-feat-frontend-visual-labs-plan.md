---
title: Frontend Visual Refresh and Labs Showcase - Plan
date: 2026-08-29
type: feat
topic: frontend-visual-labs
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
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

- **Landing-first delivery** — hero and landing cohesion ship before `/labs` content is complete; `/labs` demos echo patterns already live on the landing. Governs R1, R3, F2.

- **Hard quality gates in scope** — visual regression and mobile Lighthouse ≥90 are deliverables, not post-launch follow-ups. Governs R5, R6, R7.

- **Mobile Lighthouse Performance only as hard gate** — Accessibility, Best Practices, and SEO remain informational targets per existing project norms unless a future plan elevates them. Governs R6.

### Requirements

**Landing visual identity**

- R1. The `/` hero uses an Immersive Canvas layout: full-viewport atmospheric background, dominant centered headline, floating capability cards representing core service areas, and a primary CTA that routes visitors toward booking or exploration.
- R2. The landing page below the hero gains enough visual cohesion (nav, section rhythm, typography hierarchy, motion discipline) that the full scroll experience feels intentional and distinct — not a collection of unrelated sections. Hero + nav + CTA flow are mandatory; full section-by-section redesign of Services, HowItWorks, Founder, and FAQ is optional polish within this plan.
- R2a. All motion and shader effects respect `prefers-reduced-motion` and degrade gracefully when WebGL is unavailable, consistent with existing `use-motion-props` and `HeroShaderBackground` patterns.

**Labs showcase**

- R3. A public `/labs` route exists as a portfolio theater: 3–4 curated interactive demos drawn from real shipped work (e.g., agent loop, shader/visual effects, lead pipeline, growth tooling) that prove technical craft beyond what `/repos` lists.
- R4. `/labs` includes exactly one rotating "featured experiment" slot — a swappable surface for cutting-edge UI techniques being tested before they land on the main site. The slot mechanism is in scope; the first experiment's specific content is chosen during implementation.
- R4a. Every demo and the experiment slot end with a conversion bridge ("Want this for your product?") routing to book-a-call or lead-form CTAs.

**Quality gates**

- R5. An automated visual-regression suite captures baseline snapshots for `/` at desktop and mobile viewports, and for `/labs` once it exists. CI fails when snapshots diverge beyond an approved threshold without an intentional baseline update.
- R6. CI enforces mobile Lighthouse Performance ≥90 on `/` as a hard ship gate. Once `/labs` ships, the same threshold applies to `/labs`.
- R7. Playwright E2E smoke tests pass in CI, including fixes for any stale assertions (e.g., title mismatches between `e2e/smoke.spec.ts` and current page metadata).

**Integration**

- R8. The landing hero's secondary CTA ("Explore the lab →" or equivalent) routes to `/labs`.
- R9. `/labs` complements `/repos` — it does not replace GitHub listings with interactive proof.

### Key Flows

- F1. **First visit:** Visitor lands on `/` → immersive hero loads with capability cards → primary CTA opens booking lightbox OR secondary CTA navigates to `/labs`.
- F2. **Labs exploration:** Visitor opens `/labs` → browses curated demos → interacts with at least one demo → conversion bridge prompts booking/form.
- F3. **CI gate:** Developer opens PR with visual changes → CI runs visual-regression diff + mobile Lighthouse on `/` (and `/labs` if changed) → merge blocked if snapshots fail or Performance < 90.

### Acceptance Examples

- AE1. When a visitor has `prefers-reduced-motion: reduce` enabled, the hero and landing sections render fully visible content without opacity-0 traps or animation-dependent readability. Covers R2a.

- AE2. When `/labs` loads, at least three curated demos are interactive (not static screenshots) and one experiment slot is present (populated or explicitly marked as coming soon with a mechanism to swap content). Covers R3, R4.

- AE3. When a PR changes hero layout without updating visual-regression baselines, CI fails with a clear snapshot diff. Covers R5.

- AE4. When mobile Lighthouse Performance on `/` scores below 90, CI fails with the measured score and category breakdown. Covers R6.

- AE5. When `pnpm test:e2e` runs in CI, all smoke tests pass including homepage title and hero CTA assertions aligned to current metadata. Covers R7.

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

<!-- ce-section: work-relationships -->

### How This Work Fits Together

This plan owns the public-facing visual identity upgrade and its quality gates. Broader product work remains contextual:

- **Landing conversion pack** (from `PLAN.md`) — Shares lead-form and CTA surfaces; this plan improves the visual path into those conversions but does not own CRM or social-proof content.
- **Portal / admin surfaces** — Can proceed independently; no dependency on this work.
- **Post-launch automations** (Lighthouse reporting, digests) — Enables future monitoring once the hard gate exists here.
