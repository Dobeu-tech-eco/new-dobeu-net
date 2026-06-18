# Progress — dobeu.net v3

## 2026-05-21 — Phase 1 complete

### Done

- BRAINSTORM.md and PLAN.md drafted and approved by Jeremy
- Repo scaffolded with Next.js 15 App Router, TypeScript, Tailwind, pnpm
- Design System v2 tokens wired into globals.css and tailwind.config.ts (Indigo+Amber + Ink+Paper, Nunito + Quicksand fonts via next/font)
- Theme system: next-themes Light/Dark/System with ThemeProvider + ThemeToggle
- UI primitives: Button, Dialog, Tabs, Input/Textarea, DropdownMenu, Accordion, Label (shadcn-style)
- Supabase: client + server + admin + middleware clients + middleware.ts gating /portal and /admin
- Initial migration: profiles, projects, project_files, invoices, messages, leads, bookings, page_events all with RLS, plus storage bucket policies
- Database types in lib/database.types.ts (regenerate with `pnpm db:types` after migration runs)
- Analytics fan-out: PostHog + Mixpanel + GA4 + GTM with consent gating
- Apollo API wrapper (lib/apollo.ts)
- Landing page composition:
  - SiteNav (sticky, mobile drawer, theme toggle, Book a call CTA)
  - DobeuMark SVG (two circles + amber crescent)
  - Hero (bold typography, gradient text, dual CTA, trust strip, mesh backdrop)
  - Services (4 tiles + "Something else" CTA)
  - HowItWorks (3-step process)
  - Proof (stats + testimonials)
  - Founder (mark + bio + reasons)
  - FAQ (8 Q&A with FAQPage JSON-LD)
  - FinalCTA (gradient card)
  - StickyMobileCTA (appears after scroll on mobile)
  - SiteFooter (minimal, links)
- Lightbox with 3 tabs: Book (Apollo Meetings embed or fallback LeadForm), Tell me more (Typeform), Just email (LeadForm)
- /api/lead route: Supabase insert + Apollo upsert + Resend confirmation email + admin notification + IP rate-limit
- Auth: /login (magic-link form), /auth/callback (session exchange)
- Portal: dashboard with stat tiles, projects list, project detail [id], files, invoices, messages, settings
- Admin: overview with leads/bookings/users/MRR tiles
- SEO: sitemap.ts, robots.ts (allows GPTBot/ClaudeBot/PerplexityBot), opengraph-image.tsx (edge runtime with gradient), public/llms.txt
- Privacy + Terms pages
- Vercel config (regions iad1, security headers via next.config.ts including comprehensive CSP)
- README.md with quick start + project layout + route map
- docs/DEPLOYMENT.md with 6-phase deploy + DNS cutover + rollback plan
- docs/tracking-plan.md with every analytics event documented

### Update 2026-05-21 (later) — install fix + Calendly pivot

- **Install error** — first `pnpm install` errored with `ERR_PNPM_JSON_PARSE` on `acorn-jsx/package.json`. Fix documented in `docs/FIX-INSTALL.md`: clean reinstall + `pnpm store prune` + bump to pnpm 11.1.3.
- **Next.js CVE-2025-66478** — bumped next + eslint-config-next from `15.1.4` to `^15.5.4`. Removed deprecated `@types/mixpanel-browser` (runtime ships its own types).
- **Apollo Meetings dead end** — Composio's Apollo toolkit exposes no Meetings endpoint. Pivoted booking to Calendly free tier (1 event type @ $0/mo). Jeremy is already connected at `jeremyw@dobeu.net` with scheduling URL `https://calendly.com/jeremyw-dobeu-r_el`. `components/landing/BookingTab.tsx` now uses `react-calendly`'s `InlineWidget` themed against the active Dobeu light/dark mode, fires `calendly_*` funnel events, and mirrors confirmed bookings to `/api/lead`. CSP updated in `next.config.ts` to allow Calendly origins.
- **Env var change** — `NEXT_PUBLIC_APOLLO_MEETINGS_URL` retired; `NEXT_PUBLIC_CALENDLY_URL` added (default `https://calendly.com/jeremyw-dobeu-r_el`).

### Pending — requires Jeremy

1. Apply the install fix per `docs/FIX-INSTALL.md` and confirm `pnpm dev` boots
2. Copy `.env.example` → `.env.local`, set `NEXT_PUBLIC_CALENDLY_URL` (default value already in the file)
3. Optional: log into Calendly and create/rename the "30-minute discovery call" event type, then update `NEXT_PUBLIC_CALENDLY_URL` to point at that specific event type slug (e.g., `/30min`)
4. Create Supabase project at https://supabase.com/dashboard, copy keys into `.env.local`, run `pnpm supabase db push`
5. Create GitHub repo `dobeutech/new-dobeu-net` and push
6. Connect Vercel to the new repo and set env vars
7. Run Phase 4 verification (Lighthouse, browser walk, axe, end-to-end Calendly booking)
8. DNS cutover from old digital-wharf-dynamics to new project (per DEPLOYMENT.md)

### Next session resume protocol

1. Read .agent/state.json + this file
2. `cd new-dobeu-net && pnpm install`
3. `pnpm dev` — verify it boots
4. Walk through the Pending list above

---

## 2026-05-23 — GTM container setup + integration

### Done
- Discovered existing Web container `GTM-M97GN5T7` (containerId 233159875) under "Dobeu Tech Solutions" account (6320247522). Workspace 3 was the active default.
- Enabled 18 additional built-in variables (Click {Element,Classes,Id,Target,Url,Text}, Form {Element,Classes,Id,Target,Url,Text}, Scroll Depth Threshold/Units, History Source / New|Old History Fragment|State) on top of the existing 5 (Page URL, Page Hostname, Page Path, Referrer, Event).
- Created 7 custom dataLayer variables: `DLV - user_id`, `lead_email`, `lead_name`, `cta_label`, `cta_location`, `booking_uri`, `current_url` (IDs 4–10).
- Created 5 triggers (IDs 11–15): `CE - lead_submitted`, `CE - cta_click`, `CE - booking_started`, `Scroll - 25/50/75/90`, `Click - Outbound link` (Just Links with RE2-safe CSS-selector exclusion of dobeu.net + internal links).
- Created 6 GA4 tags (IDs 16–21), each consent-gated on `analytics_storage` and **paused** with placeholder Measurement ID `G-XXXXXXXXXX`:
  - `GA4 - Configuration` (googtag) → All Pages
  - `GA4 - lead_submitted` → trigger 11 (event: `generate_lead`)
  - `GA4 - cta_click` → trigger 12
  - `GA4 - booking_started` → trigger 13
  - `GA4 - scroll` → trigger 14
  - `GA4 - outbound_click` → trigger 15 (event: `click` with `outbound=true`)
- Pre-existing `Home` HTML tag (Apollo website-tracker) preserved and continues to fire on All Pages.
- Published as **container version 3** ("Initial Dobeu.net v3 setup") — workspace 3 is now the live version.

### Wired into the Next.js codebase
- `app/layout.tsx` — added GTM noscript `<iframe>` fallback inside `<body>`, gated on `NEXT_PUBLIC_GTM_ID`.
- `.env.local` + `.env.example` — set `NEXT_PUBLIC_GTM_ID=GTM-M97GN5T7` with a header comment explaining the paused tag state.
- `components/landing/LeadForm.tsx` — adds a second `track("lead_submitted", { lead_email, lead_name, source, has_message })` call alongside the existing `lead_captured` (kept for PostHog/Mixpanel funnel backwards-compat).
- `components/landing/Hero.tsx` + `FinalCTA.tsx` — both CTA buttons now wrap the lightbox-open via `trackAndOpen(target, label)`, which pushes `cta_click` with `cta_label`, `cta_location: hero|final_cta`, `target`.
- `components/landing/BookingTab.tsx` — `onProfilePageViewed` now also pushes `booking_started` with `booking_uri = NEXT_PUBLIC_CALENDLY_URL`; `onEventScheduled` adds `booking_uri` to the existing `booking_scheduled` event. Existing `calendly_*` funnel events untouched.

### Verification
- `./node_modules/.bin/tsc --noEmit` — green for everything I touched (Services.tsx has pre-existing errors unrelated to GTM and outside this session's scope).
- Live browser validation via Playwright MCP against the published container:
  - `GET https://www.googletagmanager.com/gtm.js?id=GTM-M97GN5T7` → **200**.
  - `window.google_tag_manager["GTM-M97GN5T7"]` defined → container code executed in a real browser.
  - All 3 custom events (`lead_submitted`, `cta_click`, `booking_started`) received `gtm.uniqueEventId` from the container → triggers are listening.
  - Scroll Depth trigger auto-fired all 4 thresholds (25/50/75/90) on the test viewport.
  - Apollo website-tracker tag fired its payload (`assets.apollo.io/.../tracker.iife.js → 200`) → All Pages trigger still works.
  - No GA4 beacons (correct — all 6 GA4 tags are paused with placeholder G-XXXXXXXXXX).
  - Screenshot saved at `gtm-test-aboutblank.png`.

### Pending / next steps
1. **Plug in real GA4 Measurement ID** — set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` in `.env.local` + Vercel, then update tags 16–21 in GTM workspace 3 (replace `G-XXXXXXXXXX`, set `paused: false`) and publish a new container version. The gtm-mcp-server `gtm_tag` `action: update` works for this; or do it in the Tag Manager UI.
2. Once GA4 is live, **mark `generate_lead` as a conversion** in GA4 (Admin → Events → Mark as conversion). Same for `cta_click` if Jeremy treats it as a KPI.
3. Add the `lead_capture_failed` path to GTM if you want failed-submission visibility (not configured yet; only `lead_submitted` is wired).
4. **Local smoke test on Windows**: `pnpm dev` and click each CTA / submit the form / open the Calendly lightbox; open DevTools console and watch `window.dataLayer` populate. The sandbox here could not run `pnpm dev` (SWC binary platform mismatch), so the browser-side wiring needs a real Windows boot before merge.
5. `public/gtm-test.html` is a self-contained harness for ad-hoc container testing — keep it (it's `noindex`) or move under `.agent/` if you'd rather it not ship.

