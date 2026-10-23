# Business technology positioning

## Follow-up: personal collaboration

The owner clarified that Dobeu is Jeremy Williams' business for passion projects, with an invitation to like-minded collaborators and potential product partnerships. Retain the useful-technology positioning and four-product showcase, but replace agency-style acquisition CTAs with personal conversation, add a brief factual bio, and correct LinkedIn to https://www.linkedin.com/in/jswilliamstu.

Plan: update shared identity/bio and collaboration copy; route the main invitation to the existing message form rather than the budget intake; align dialog/confirmation copy without changing delivery or consent behavior; preserve account flows and commercial terms; verify unit tests, browser interaction, and refreshed Linux visuals. The profile's broad transportation/logistics/supply-chain background is supported by publicly indexed LinkedIn and its linked GitHub profile. No unverified employment, credentials, or career-duration claims will be added.

## Done when

- Public positioning says “We build usable business technology.”
- The homepage and portfolio feature RouteReady, Chima Comics, and Dobeu.space with direct product links and factual descriptions.
- Public pages, metadata, social previews, Labs, and repository feeds no longer promote AI, agents, or consulting services.
- Additional Cloudflare properties are included only when their current public content establishes a suitable product; domains alone are not evidence of a shipped product.
- Intake, booking, account access, and stored work-order categories remain compatible.
- Content checks, relevant regression tests, typecheck, lint, production build, and browser review are recorded.

## Cleanup plan

1. Inventory public content and Cloudflare properties read-only.
2. Use the existing landing interaction tests as the behavior baseline; add tests for product links and curated external feeds.
3. Replace shared positioning and portfolio data, then update public renderers and metadata. Remove obsolete promotional entries rather than adding a second content layer.
4. Keep persisted identifiers and private integration behavior stable; replace customer-visible labels where needed.
5. Independently review the finished diff and verify the public surfaces.

## Boundaries

No production deployment, external configuration change, commit, or push is included. Existing harness decisions remain: `.omc/` and `.impeccable/` coexist; `.agent/` plans are read-only imported context. The harness interview is paused while this explicitly requested site change is implemented.

## Personal collaboration implementation

The homepage now introduces Jeremy and mounts the founder bio alongside the product showcase. Hero, navigation, contact, and shared form copy invite collaboration; the main invitation opens the existing idea-sharing form. Booking remains available as “Meet Jeremy.” Supporting pages, metadata, footer, FAQs, and the lead receipt use the same personal positioning. Paid scoped work remains secondary, with existing commercial terms unchanged.

Fresh `pnpm verify` passed: 67 test files, 696 tests, type-check, lint, and strict production build. Existing lint warnings remain. A separate read-only review returned no actionable findings. Visual review found and corrected one remaining sales-style CTA in Labs ExperimentSlot; targeted lint and a fresh strict build passed afterward. Desktop/mobile Playwright checks passed: 103 tests, 3 intentional duplicate mobile API skips. Screenshots were reviewed at both viewports. All six Linux amd64 visual baselines were refreshed for this follow-up; the independent no-update run passed 6/6 after the final Labs copy correction. Form regression tests cover the unchanged request contract, successful submission, and failure handling without sending live messages.

## Baseline

- Clean `main` at `d006cc0` before edits.
- `pnpm test:ci components/landing/LandingRouting.test.tsx`: 8 tests passed before homepage edits.
- Dependencies installed from the unchanged lockfile with pnpm 10.34.1.

## Product evidence and scope decisions

Read-only public-site checks on 2026-10-22 support:

- [RouteReady](https://routereadyhq.com/welcome): driver training, signed records, and downloadable training packets. Publicly in beta; no claim that training packets replace a driver qualification file.
- [Chima Comics](https://chimacomics.shop): free opening chapters, merchandise, and a browser puzzle game.
- [Dobeu.space](https://dobeu.space): supply-chain technology journal. Its own site still promotes AI-related work; editing that separate property is outside this checkout.
- [Ikram & Co.](https://www.dobeu.store/en): original art, limited editions, and stickers from Arab artists; footer identifies Dobeu Tech Solutions LLC.

Cloudflare returned all 16 zones on one page and 11 Worker scripts. Ikram & Co. is the additional verified public product selected. Other domains were unavailable, service/coaching sites, internal sign-in surfaces, or lacked evidence of Dobeu authorship. No internal fleet application is presented as a public product. Cloudflare account settings were not changed.

## Review findings

An independent review found two dynamic-content gaps: the repository viewer could display arbitrary third-party promotional text, and the activity API hid upstream failure as an empty success. Both were fixed with a curated viewer and explicit error handling, with regression coverage. The reviewer approved the follow-up with zero unresolved findings.

## Verification

- `pnpm verify`: passed; 66 test files, 693 tests, typecheck, lint, and strict production build. Lint reports 7 existing warnings and no errors.
- `pnpm test:e2e e2e/smoke.spec.ts e2e/business-positioning.spec.ts --project=chromium --project=mobile-chrome --workers=2 --reporter=line`: 101 passed, 3 existing duplicate mobile API checks skipped.
- Public browser audit covers 23 routes on both viewports, checking rendered text, page metadata, structured data, accessible labels, image alt text, product links, and horizontal overflow.
- Desktop and mobile homepage screenshots visually reviewed. The native preview snapshot timed out twice; verification used the repository's documented Playwright workflow.
- Authenticated account flows were not exercised against a live backend. Stored work-order identifiers remain unchanged; visible labels use Business systems.
- All six Linux visual baselines regenerated and visually reviewed in the pinned Playwright 1.64.1 Ubuntu Noble image, explicitly `linux/amd64` (x86_64), Node 24, pnpm 10.34.1. Generation passed 6/6; a separate run without updates passed 6/6. Only the six Linux PNGs were copied back.

## Harness continuation

Setup decisions retained: single repo; no related repos; Vercel at https://dobeu.net; `.omc/` and `.impeccable/` coexist, `.agent/` imported read-only. Roster approved: Claude (lead/verifier/builder/reviewer), Codex (builder/second opinion), Copilot (builder/security reviewer), Gemini and Grok (builder/reviewer/second opinion), Muse (builder/second opinion). Claude/Codex/Copilot subscriptions detected; Gemini/Grok/Muse subscriptions confirmed by user.

Six components and the seven-layer blueprint were confirmed. The subsequent 66-section map was proposed but not approved; the user instead requested this positioning change. Resume setup by incorporating the completed change into that map, then continue its remaining approval and acceptance-criteria steps. No end-state approval or scaffold rewrite is implied by this implementation request.

## Owner biography clarification

Jeremy clarified that supply chain is his professional background and he has always been a tech nerd and open-source builder by night. The shared founder bio, homepage introduction, About metadata, and crawler summary now explicitly distinguish his career from his personal building interests. This wording is owner-provided.

Biography follow-up validation: 12 targeted data tests passed; ESLint and strict production build passed; the homepage biography browser check passed on desktop and mobile.

## Latest owner direction: deliberately vague biography

Keep the public introduction broad and personal. Removed specific career background, by-night framing, location beside the founder title, and named project examples inside the bio. Retain Jeremy’s name, LinkedIn, curiosity, passion projects, and collaboration. The separate product showcase remains. This supersedes the earlier detailed-biography direction.
