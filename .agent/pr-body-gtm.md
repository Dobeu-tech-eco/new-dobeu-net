## Summary

Wires the published GTM container `GTM-M97GN5T7` into the Next.js app and adds the matching `dataLayer` events that the new triggers listen for.

## GTM container (provisioned via the GTM API on 2026-05-23)

- Workspace 3 published as **version 3** ("Initial Dobeu.net v3 setup").
- **18 built-in variables** enabled (full Click/Form/Scroll/History coverage on top of the existing 5).
- **7 custom dataLayer variables**: `DLV - user_id`, `lead_email`, `lead_name`, `cta_label`, `cta_location`, `booking_uri`, `current_url`.
- **5 triggers**:
  - `CE - lead_submitted` (custom event)
  - `CE - cta_click` (custom event)
  - `CE - booking_started` (custom event)
  - `Scroll - 25/50/75/90` (scroll-depth thresholds)
  - `Click - Outbound link` (Just Links with RE2-safe CSS-selector exclusion of dobeu.net + internal links)
- **6 GA4 tags**, each consent-gated on `analytics_storage`, **paused** with placeholder Measurement ID `G-XXXXXXXXXX`:
  - `GA4 - Configuration` (Google Tag) → All Pages
  - `GA4 - lead_submitted` → `generate_lead` event
  - `GA4 - cta_click`
  - `GA4 - booking_started`
  - `GA4 - scroll`
  - `GA4 - outbound_click` (`click` with `outbound=true`)
- Pre-existing Apollo website-tracker HTML tag preserved and continues to fire on All Pages.

## Code wiring

| File | Change |
|---|---|
| `.env.example`, `.env.local` | `NEXT_PUBLIC_GTM_ID=GTM-M97GN5T7` + header comment about the paused GA4 tags |
| `app/layout.tsx` | GTM `<noscript><iframe>` fallback inside `<body>`, gated on `NEXT_PUBLIC_GTM_ID` |
| `components/landing/LeadForm.tsx` | Adds `track("lead_submitted", { lead_email, lead_name, source, has_message })` alongside legacy `lead_captured` |
| `components/landing/Hero.tsx` | CTA buttons wrap open via `trackAndOpen()` → pushes `cta_click` with `cta_label`, `cta_location: "hero"` |
| `components/landing/FinalCTA.tsx` | Same pattern, `cta_location: "final_cta"` |
| `components/landing/BookingTab.tsx` | `onProfilePageViewed` pushes `booking_started` with `booking_uri`; `onEventScheduled` adds `booking_uri` to existing `booking_scheduled` |
| `public/gtm-test.html` | Self-contained test harness (`noindex`) |
| `.agent/progress.md` | Full session log |

## Verification

- **TypeScript** — `tsc --noEmit` is green for everything touched in this PR. The pre-existing `Services.tsx` errors are unrelated and untouched.
- **Live browser validation via Playwright MCP** against the published container:
  - `GET https://www.googletagmanager.com/gtm.js?id=GTM-M97GN5T7` → **200**
  - `window.google_tag_manager["GTM-M97GN5T7"]` defined → container code executed in a real Chromium
  - All 3 custom events (`lead_submitted`, `cta_click`, `booking_started`) received `gtm.uniqueEventId` → triggers are listening
  - Scroll Depth trigger auto-fired all 4 thresholds on the test viewport
  - Apollo website-tracker fired its payload (`assets.apollo.io/.../tracker.iife.js → 200`) → All Pages trigger still works
  - No GA4 beacons (expected — all 6 GA4 tags are paused with placeholder `G-XXXXXXXXXX`)

## Note on diff size

Raw diff is **300 inserts / 199 deletes**, logical diff is **109 inserts / 8 deletes**. The delta is CRLF→LF normalization on files that were already in `M` status before this branch's work began. Review with `git diff -w` to see only the substantive changes.

## Follow-ups (out of scope for this PR)

1. Set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` and replace `G-XXXXXXXXXX` in tags 16–21 of GTM workspace, then unpause and publish a new container version.
2. Mark `generate_lead` as a conversion in GA4.
3. Local Windows `pnpm dev` smoke test (the sandbox couldn't run it due to SWC platform mismatch).
4. Optional: wire `lead_capture_failed` into GTM if you want failed-submission visibility.
