# dobeu.net v3 — Implementation Plan

**Status:** Awaiting Jeremy's approval
**Brainstorm:** `BRAINSTORM.md` (read first)
**Working dir:** `C:\Users\jswil\repos\new-dobeu-net`
**Target deploy:** Vercel preview → DNS cutover to `dobeu.net` on approval

---

## Execution model

Six phases. Each phase ships independently, has its own verification gate, and can be paused/resumed at the boundary. Phases 2–5 use parallel subagents where work is independent (per `superpowers:subagent-driven-development` and `superpowers:dispatching-parallel-agents`).

```
Phase 0 → Phase 1 → ┌── Phase 2A (landing) ─────┐
                    ├── Phase 2B (auth+portal) ─┤ → Phase 3 → Phase 4 → Phase 5
                    └── Phase 2C (admin) ───────┘
```

---

## Phase 0 — Approval (you are here)

**Owner:** Jeremy
**Exit gate:** Jeremy says "approved, go" (or specific edits required) in chat.

Deliverable: this plan + `BRAINSTORM.md`, read and approved.

Decisions still needing Jeremy input *before* code:
1. **Repo:** new `dobeutech/new-dobeu-net` repo *(default)*, or force-rewrite `dobeutech/digital-wharf-dynamics`? See Open Question #1 in brainstorm.
2. **Apollo Meetings:** I'll verify embed availability against your plan via the Apollo MCP during Phase 1 — no decision needed from you, but if it falls back to custom, the custom flow needs Google Calendar OAuth (your Google account). OK to wire that up?
3. **ADMIN_EMAILS:** confirm `jswilliamstu@gmail.com` is the only admin in v1.

---

## Phase 1 — Foundation (single-threaded, ~45 min)

Set up the skeleton so parallel work can begin in Phase 2.

1. **Repo init** — create `new-dobeu-net` (or rewrite digital-wharf-dynamics per Q1), init Next.js 15 App Router with TypeScript + Tailwind + ESLint + Prettier. Add `pnpm` lockfile.
2. **Design tokens wire-up** — copy `@dobeu/tokens` CSS variables into `app/globals.css`, build Tailwind config from the same source. Install Nunito + Quicksand via `next/font/google`. Configure `next-themes` for Light/Dark/System.
3. **shadcn/ui scaffold** — `npx shadcn@latest init`, add base components (button, dialog, sheet, dropdown, form, input, tabs, accordion, toast/sonner). Override default theme with Dobeu tokens.
4. **Supabase project** — verify project exists (or create); enable Email auth; create initial migration with all tables from §8 of brainstorm; commit `supabase/migrations/`. Generate types to `lib/database.types.ts`.
5. **Env scaffolding** — `.env.example` with every needed var. Document each in README. Use Vercel env via `vercel env pull` later.
6. **Layout shell** — `app/layout.tsx` with `<ThemeProvider>`, `<AnalyticsProvider>`, `<Toaster>`, `<CookieConsent>`. Sticky nav. Footer. Skip-to-content link. Reading-order verified.
7. **Connection check** — call Apollo / Supabase / Stripe / PostHog / Resend MCPs once each to confirm credentials are live. Log results to `docs/connection-check-2026-05-21.md`.

**Verification gate:** `pnpm dev` renders a styled, themed empty homepage at `http://localhost:3000` in both light + dark, with the Dobeu logo (sourced from `OneDrive/.../dobeu-eco-logo-all/`) and Nunito visibly applied.

---

## Phase 2 — Build (three parallel streams)

Subagent A, B, C work concurrently against the foundation laid in Phase 1. Each gets a worktree branch so they can't step on each other.

### Phase 2A — Marketing landing
**Subagent:** frontend-developer
**Worktree:** `feature/landing`
**Tasks:**
- Hero with bold typography + dual CTA + trust strip
- "What I do" — 4 service tiles + "something else" tile
- "How it works" — 3-step process with mark animation
- Proof section — logo wall (placeholder if none) + 2-3 testimonial quotes
- Founder section — photo + bio + LinkedIn link
- FAQ accordion with `FAQPage` JSON-LD
- Sticky bottom CTA bar on mobile
- Footer (logo, email, LinkedIn, status, privacy, terms)
- The **lightbox modal** with three tabs (Book / Typeform / Email)
- All copy drafted; marked `<!-- COPY:REVIEW -->` where Jeremy review is required
- Mobile (375px) + tablet (768px) + desktop (1280px) breakpoints
- Light + Dark + System theme parity

### Phase 2B — Auth + Client portal
**Subagent:** fullstack-developer
**Worktree:** `feature/portal`
**Tasks:**
- Supabase Auth middleware (`@supabase/ssr`)
- `/login` page with magic-link form
- `/auth/callback` handler
- `<ProtectedRoute>` HOC + server-side `requireUser()`
- `/portal/dashboard` — open projects, unpaid invoices, unread messages widgets
- `/portal/projects` + `/portal/projects/[id]` with timeline + files + thread
- `/portal/files` — signed-URL downloads with retention badge
- `/portal/invoices` — list + "Pay" → Stripe Checkout link
- `/portal/messages` — threaded view, 30s poll
- `/portal/settings`
- Server actions for all mutations; no client-side Supabase writes
- RLS verified by tests: cross-tenant read returns empty

### Phase 2C — Admin panel + integrations backend
**Subagent:** backend-architect + frontend-developer
**Worktree:** `feature/admin`
**Tasks:**
- `<AdminRoute>` HOC gated by `ADMIN_EMAILS` env list
- `/admin/dashboard` with KPI tiles + recent activity feed
- `/admin/users` + `/admin/users/[id]` with edit + project create
- `/admin/projects` + `/admin/projects/[id]` with file upload + status edit
- `/admin/invoices/new` — Stripe invoice creator
- `/admin/leads` — Apollo-enriched lead table, filter by source/UTM
- `/admin/bookings` — upcoming + past, sync state
- `/admin/analytics` — embedded PostHog + Mixpanel + summary widgets
- **API routes** for:
  - `POST /api/lead` (Supabase + Apollo upsert + analytics fan-out)
  - `POST /api/book` (booking create + Apollo activity + confirmation email)
  - `POST /api/webhooks/stripe` (invoice paid/failed → Supabase)
  - `POST /api/webhooks/apollo` (booking confirmed/cancelled)
  - `POST /api/webhooks/resend` (delivery/bounce tracking)
- Server-side Apollo client wrapper in `lib/apollo.ts` (key in env)
- Server-side PostHog/Mixpanel/GA4 server-event firing in `lib/analytics.ts`

**Verification gate (all three):** each branch's PR shows: build green, unit tests green, Playwright happy-path test green, screenshots attached for mobile/desktop/light/dark.

---

## Phase 3 — Integration + tracking plan

Merge 2A/2B/2C to `main` in order, resolving conflicts at the route+layout boundary.

1. **Merge order:** 2C (backend APIs) → 2B (portal needs APIs) → 2A (landing needs portal links).
2. **Tracking plan** — write `docs/tracking-plan.md` listing every event (name, properties, fires-where, fires-when). Includes: `$pageview`, `lead_captured`, `lead_form_submitted`, `booking_scheduled`, `booking_completed`, `signup`, `login`, `file_downloaded`, `invoice_viewed`, `invoice_paid`, `message_sent`, `admin_action_*`. Cross-referenced to PostHog/Mixpanel/GA4.
3. **GTM container** — create GTM container with tags for GA4 + PostHog + Mixpanel + Apollo pixel. Export config JSON to `docs/gtm-container.json` for reference.
4. **CSP + cookie consent** — finalize `next.config.js` CSP, deploy cookie consent banner with explicit categories (essential/analytics/marketing).
5. **OG image generation** — `app/opengraph-image.tsx` using the indigo→amber gradient + Nunito.
6. **Sitemap + robots + llms.txt** — auto-generated at build.

**Verification gate:** real session walkthrough fires every event in the tracking plan, verified in PostHog Live Events and GA4 DebugView.

---

## Phase 4 — Verification (the gate that matters)

Per `superpowers:verification-before-completion`. Nothing ships until this gate is fully green.

1. **Lighthouse** (mobile + desktop) on `/` and `/portal/dashboard`:
   - Perf ≥90 / A11y ≥95 / BP ≥90 / SEO ≥95
2. **Browser-as-human walkthrough** (Playwright + Chrome DevTools MCP):
   - First-time visitor: scrolls to bottom, opens lightbox, books a call → Apollo + Supabase + PostHog all show the lead.
   - First-time visitor: opens lightbox, submits Typeform → lead captured, Customer.io welcome fires.
   - First-time visitor: drops email in lightbox tab 3 → lead captured, welcome fires.
   - Returning lead: clicks email magic link → lands in `/portal/dashboard`, sees their project (or empty state).
   - Existing client: views invoice → clicks "Pay" → completes Stripe test checkout → invoice flips to paid in portal + admin.
   - Admin: logs in → uploads a file to a project → client sees it on refresh and downloads it.
3. **Accessibility:** axe + manual screen reader pass (VoiceOver / NVDA) on landing + portal.
4. **Cross-browser:** Chrome, Firefox, Safari (Webkit), mobile Safari, mobile Chrome via Playwright.
5. **Theme parity:** every page in Light, Dark, System (matches OS).
6. **A/B test scaffold** — wire PostHog feature flag for hero copy variant (one experiment ready to run post-launch). Per `marketing-skills:ab-test-setup`.
7. **Verification artifacts** committed to `docs/verification/2026-05-21/`:
   - `lighthouse-landing-{mobile,desktop}.html`
   - `lighthouse-portal-{mobile,desktop}.html`
   - `walkthrough-screenshots/` (one per flow × theme × viewport)
   - `axe-report.json`
   - `tracking-verification.md` (event names + screenshots from PostHog/GA4)

**Verification gate:** all of the above + Jeremy spot-checks the preview URL and signs off.

---

## Phase 5 — Production cutover

Once Jeremy signs off in Phase 4.

1. Verify production env vars in Vercel (Apollo, Supabase, Stripe live keys, etc.).
2. Switch Stripe webhook URL from old → new deployment.
3. Switch Apollo webhook URL.
4. Update DNS: `dobeu.net` `A` / `CNAME` → new Vercel project.
5. Wait for propagation (~5 min usually).
6. Smoke test: real submission with real email, real Stripe test invoice, real magic link.
7. Email existing Auth0 users a "we've upgraded — re-verify with this magic link" notice.
8. Decommission old Netlify site (downgrade plan to free or delete after 7-day soak).

**Verification gate:** real user `jswilliamstu@gmail.com` end-to-end test on production passes.

---

## Phase 6 — Post-launch (optional, scheduled)

Things to schedule via `mcp__scheduled-tasks__create_scheduled_task` once live:
- Daily 8am ET: PostHog → Slack summary of yesterday's leads + bookings + paid invoices.
- Weekly Mon 9am ET: A/B test status check + Lighthouse audit + uptime report.
- Monthly first-of-month: Stripe invoice aging report.

---

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Apollo Meetings not embeddable | Med | Med | Phase 1 verifies; custom Supabase availability picker as fallback (same data model). |
| Existing Auth0 users locked out at cutover | Med | Med | Email blast with magic link 24h before DNS swap; preserve old site for 7-day soak. |
| Lighthouse perf score below 90 on mobile | Med | Low | Bundle analyzer in Phase 4; lazy-load PostHog + heavy embeds; `next/image` everywhere. |
| Vercel CSP blocks PostHog/Mixpanel | Low | Low | CSP allowlist drafted in Phase 3, tested with `report-only` mode first. |
| Stripe webhook misconfig → invoices stuck | Low | High | Webhook signature verification + retry-safe handlers + manual reconciliation endpoint. |
| Subagent scope creep | Med | Med | Each subagent gets a tight brief + worktree; reviews happen at PR boundaries. |

---

## Definition of done

- [ ] All 6 phases complete
- [ ] `dobeu.net` serves new site from Vercel
- [ ] Lighthouse all ≥ targets
- [ ] Every event in tracking plan verified in PostHog + GA4
- [ ] One real lead captured end-to-end (Jeremy's test submission)
- [ ] Admin can upload file → client downloads
- [ ] Stripe test invoice paid → status flips
- [ ] Old Netlify site decommissioned or in soak mode
- [ ] `MEMORY.md` updated with operational notes
- [ ] Final summary doc at `docs/launch-2026-05-21.md`

---

## Approval status (2026-05-21)

**APPROVED by Jeremy.** Decisions confirmed:

1. **Repo:** new repo `dobeutech/new-dobeu-net` (clean history, new Vercel project, swap DNS when green).
2. **Booking:** verify Apollo Meetings embed in Phase 1 first; if not embeddable, return with Google Calendar OAuth recommendation before committing.
3. **Admin in v1:** `ADMIN_EMAILS = ["jeremyw@dobeu.net"]` only.

Proceeding to Phase 1.
