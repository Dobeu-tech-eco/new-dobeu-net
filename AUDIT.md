# dobeu.net — Site Audit & Remediation Report

**Audited:** 2026-06-20  
**Auditor:** v0 (Vercel AI) — audit reconstructed after prior chat disconnection  
**Branch:** `unzip-and-continue` (feature branch off `main`)  
**Scope:** Landing page (dobeu.net) — accessibility, SEO/structured data, brand ethics, conversion integrity

---

## Audit Method

1. Live-site Web Vitals via `agent-browser vitals https://dobeu.net --json`
2. Mobile accessibility tree via `agent-browser` (iPhone 14 emulation)
3. Static source review of all landing section components and `app/layout.tsx`
4. Pattern grep for `whileInView`, `initial=`, `prefers-reduced-motion`, `@type`, JSON-LD

---

## Web Vitals (Desktop, Lab, 2026-06-20)

| Metric | Value | Threshold (Good) | Status |
|--------|-------|-----------------|--------|
| TTFB   | 5 ms  | ≤ 800 ms        | PASS   |
| FCP    | ~220 ms | ≤ 1800 ms     | PASS   |
| LCP    | 380 ms | ≤ 2500 ms      | PASS   |
| CLS    | 0.000 | ≤ 0.1           | PASS   |
| INP    | n/a (no interaction in test) | ≤ 200 ms | —  |

**Mobile (deferred — P2):** Lighthouse mobile score ~80. Known gap; primarily analytics/embed
third-party script weight. Not blocking launch.

---

## Findings

### P0 — Accessibility (WCAG 2.1 SC 2.3.3 + SC 1.4.3)

**Finding: Framer Motion `initial={{ opacity: 0 }}` not respected by `prefers-reduced-motion`**

- **Affected files:** `Hero.tsx`, `Services.tsx`, `HowItWorks.tsx`, `Founder.tsx`, `FinalCTA.tsx`
- **Root cause:** `globals.css` correctly sets `animation-duration: 0.01ms` under
  `prefers-reduced-motion: reduce`, but Framer Motion sets `opacity: 0` as an inline
  `style` attribute at the JS layer before the CSS animation kill takes effect. Elements
  that use `whileInView` can stay invisible indefinitely for users with reduced motion who
  scroll past them quickly, or on low-power devices where the Intersection Observer fires
  slowly.
- **Status: FIXED** — `hooks/use-motion-props.ts` hook added. `useReducedMotion()` from
  `motion/react` is called once per component; when `true`, `initial` / `animate` /
  `whileInView` are all set to the fully-visible target state, making content immediately
  readable. CSS belt-and-suspenders rule also added to `globals.css` targeting
  `[style*="opacity:0"]`.
- **Files changed:**
  - `hooks/use-motion-props.ts` (new)
  - `app/globals.css` (strengthened `@media (prefers-reduced-motion: reduce)`)
  - `components/landing/Hero.tsx`
  - `components/landing/Services.tsx`
  - `components/landing/HowItWorks.tsx`
  - `components/landing/Founder.tsx`
  - `components/landing/FinalCTA.tsx`

---

### P1 — Brand Ethics / Conversion (Dobeu brand rule: "social proof only when genuinely true")

**Finding: `Proof` section contained fabricated testimonials and unverifiable statistics**

- **Affected file:** `components/landing/Proof.tsx`
- **Details:** The section rendered two testimonials attributed to generic personas
  ("Operations Lead, Logistics SaaS, NYC" / "Founder, Early-stage fintech") with
  no verifiable identity, and a stats strip ("17 properties built", "100% on-time",
  "7+ years shipping", "3 wks avg. project length") presented as factual.
- **Brand rule violated:** Dobeu custom instructions state "Use social proof, scarcity,
  or benefit framing only when genuinely true."
- **Decision (user-approved):** Remove section entirely until genuine, attributable
  client quotes and verifiable numbers are available.
- **Status: FIXED**
- **Files changed:**
  - `app/page.tsx` — `<Proof />` usage removed; `dynamic()` import removed
  - `components/landing/Proof.tsx` — file kept on disk (not deleted), but no longer
    mounted. Can be re-populated with real content and re-added to `page.tsx`.

---

### P1 — SEO / Structured Data

**Finding: `WebSite` and `Person` JSON-LD schemas missing**

- **Affected file:** `app/layout.tsx`
- **Details:** Only `Organization` JSON-LD was present. Missing schemas:
  - `WebSite` — required for Google Sitelinks Searchbox eligibility and canonical
    site-name signal in SERPs.
  - `Person` — founder knowledge-panel signal linking Jeremy Williams to the org.
- **Status: FIXED** — Replaced the single `Organization` script block with a `@graph`
  document containing all three types (`WebSite`, `Person`, `Organization`) with proper
  `@id` cross-references per schema.org best practice.
- **Files changed:** `app/layout.tsx`

---

## Deferred / P2 Items (documented, not built in this pass)

| Item | Why deferred | Owner |
|------|-------------|-------|
| Mobile Lighthouse ~80 → 90 | Analytics script weight; needs bundle analysis + `next/script strategy="lazyOnload"` audit | Engineering |
| Intercom identity HMAC secret | Operational config; no code needed | Jeremy |
| Stripe webhook signature verification | Operational; separate PR | Engineering |
| Resend DKIM + SPF DNS records | DNS config only | Jeremy / DNS |
| Legacy DB decommission | After cutover confirmed stable | Jeremy |
| Real social proof (Proof section) | Content needed before code | Jeremy / clients |

---

## What Was Not Changed

- `SiteNav.tsx`, `SiteFooter.tsx`, `StickyMobileCTA.tsx`, `FAQ.tsx`, `LightboxProvider.tsx`
  — no motion or schema issues found
- `FAQPage` JSON-LD in `FAQ.tsx` — already correct; left untouched
- All existing `metadata` exports — canonical, OG, Twitter cards remain correct
- No `#proof` nav anchors existed anywhere — no broken links from Proof removal

---

## Verification Steps (post-merge)

1. `pnpm build` — must complete with 0 type errors
2. `agent-browser open https://dobeu.net` + snapshot on iPhone 14 — all section headings
   must appear in AX tree without needing to scroll past them
3. Simulate `prefers-reduced-motion: reduce` in Chrome DevTools Rendering panel — verify
   Hero text, Services cards, HowItWorks steps, Founder bio all render fully visible on
   load with no fade-in
4. Google Rich Results Test (`search.google.com/test/rich-results`) — paste dobeu.net URL;
   confirm FAQPage + WebSite + Organization detected with no errors
5. No `<Proof>` or `#proof` reference in rendered HTML source
