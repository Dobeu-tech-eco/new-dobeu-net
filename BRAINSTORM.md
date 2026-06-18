# dobeu.net v3 — Brainstorm

**Date:** 2026-05-21
**Author:** Jeremy Williams (with Claude/Cowork)
**Status:** Awaiting approval
**Purpose:** Replace the current React+Vite SPA at https://dobeu.net with a Next.js 15 marketing landing + minimal client portal, hosted on Vercel, built against the Dobeu Design System v2.

---

## 1. Why this exists

The current site (`digital-wharf-dynamics`, React+Vite SPA, Netlify) is a holdover. It's heavy, uses an outdated brand palette (Electric Lemon / Azure Tech) that doesn't match Dobeu Design System v2 (Indigo `#6B5CE7` + Amber `#F4A261`), and the Auth0/Netlify Functions stack is more infra than the current product needs. Worse, the SPA model hurts SEO and AI-citation discoverability — important now that we're optimizing for LLM mentions.

dobeu.net v3 is a **lead-generation funnel with a lightweight client portal**. Not a SaaS app, not a portfolio site — a place that turns visitors into booked discovery calls and (after a project ships) gives clients a clean place to download work, pay invoices, and message you.

## 2. Goals (in priority order)

1. **Convert visitors → booked calls.** Bold hero. Lightbox CTA visible above the fold. Three progressive capture paths (book / Typeform / email) so we capture intent at every level.
2. **Capture every visitor's identity + behavior.** Apollo enrichment, PostHog + Mixpanel + GA4 + GTM, UTM persistence, page events to Supabase. Even bounced visitors should be identifiable when possible.
3. **Give existing clients a clean portal.** Email magic-link login. See projects, download deliverables, view + pay invoices, send you messages. No bells and whistles in v1.
4. **Give Jeremy an admin console.** Add users, upload deliverables, issue invoices, read messages, see leads/bookings, see analytics.
5. **Production-ready.** WCAG 2.1 AA, Lighthouse Perf≥90 / A11y≥95 / BP≥90 / SEO≥95, mobile + desktop + light/dark/system themes.

## 3. Decisions captured

| Decision      | Choice                                                                                                        | Why                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | **Next.js 15 (App Router, RSC)**                                                                              | Best SEO, server components, image optimization, edge runtime, ISR. Vercel-native.                                                                                                 |
| UI            | Tailwind 3 + shadcn/ui (Radix) + Framer Motion (`motion/react`)                                               | Matches design system token model; shadcn ports cleanly from old repo.                                                                                                             |
| Auth          | **Supabase Auth (email magic-link)**                                                                          | No Auth0 cost. Email-only sign-up per the spec. Supabase already in use.                                                                                                           |
| DB            | **Supabase Postgres + RLS**                                                                                   | Replaces Auth0+Supabase split — one provider, one bill. RLS for portal isolation.                                                                                                  |
| Booking       | **Calendly free tier** (existing account at jeremyw@dobeu.net, URL `https://calendly.com/jeremyw-dobeu-r_el`) | Apollo doesn't expose a public Meetings API. Calendly free tier covers 1 event type at $0/mo. Embeds inline via `react-calendly`. Bookings still mirror to Apollo via `/api/lead`. |
| Lead capture  | **Apollo (auto-upsert) + Typeform (qualified intake) + Supabase (raw)**                                       | Triple write so we never lose a lead. Apollo is the system of record.                                                                                                              |
| Analytics     | **PostHog (primary, product) + Mixpanel (funnel) + GA4 (acquisition) + GTM (tag orchestration)**              | PostHog for session replay + feature flags + experiments. Mixpanel for funnel reports. GA4 for paid attribution. GTM as the bus.                                                   |
| Payments      | **Stripe Checkout + Stripe webhooks → Supabase**                                                              | Already integrated in old site; reuse the patterns.                                                                                                                                |
| Email         | **Resend** (transactional) + **Customer.io** (lifecycle, if quota permits)                                    | Already in Dobeu Eco stack; cheap and reliable.                                                                                                                                    |
| Hosting       | **Vercel** (preview → DNS cutover)                                                                            | Confirmed by Jeremy. Existing Vercel project on `dobeu.net`.                                                                                                                       |
| Repo          | New repo `dobeutech/new-dobeu-net` (or rename existing to `dobeu-net` and force-push fresh main)              | Decision deferred — see Open Questions.                                                                                                                                            |
| Design tokens | Consume `@dobeu/tokens` CSS vars + Tailwind config from the design system monorepo                            | Single source of truth; no hardcoded hex.                                                                                                                                          |
| Themes        | next-themes — Light / Dark / System                                                                           | Dark surface `#1A1A2E`, light surface `#FAFAFC`, both indigo+amber accent.                                                                                                         |
| Type          | **Nunito** (primary) + **Quicksand** (display fallback) + system mono (code)                                  | Per design system spec. Hosted via `next/font` for perf.                                                                                                                           |
| i18n          | **Deferred to v2.** Single-language (en) for v1.                                                              | Old site had EN/ES/FR — but routing complexity isn't worth it for a lead-gen page until we have proven demand outside EN.                                                          |

## 4. The page

One page. Scrolling. No multi-page maze. Anchors in the nav so it feels like a real site but only one route.

### Section flow (top → bottom)

```
[Sticky Nav]  dobeu · work · about · book a call (primary) · login

[Hero]        H1: "Ship the agent. Ship the app. Ship the brand."
              Sub: One operator. Modern stack. Production-grade work for founders
                   who need it shipped, not pitched.
              CTA primary:   [Book a call →]   (opens lightbox)
              CTA secondary: [Tell me about your project]  (opens Typeform)
              Trust strip:   "Building since 2019 · Based in NYC · Stripe-verified"

[What I do]   Four tiles, each with one-line value prop + "Tell me more" expand
              ─ AI agents & automation (Claude + Composio + agentic workflows)
              ─ Full-stack web apps (Next.js + Supabase + Vercel)
              ─ Brand & design systems (Figma + tokens + component libraries)
              ─ Marketing & growth engineering (SEO + analytics + lifecycle)
              + a 5th tile: "Something else?" → opens Typeform with custom field

[How it works] 3 steps: 1) 30-min discovery 2) Scoped proposal 3) Ship in 2-6 wks
              Visualized with the dobeu mark (two circles + amber crescent)

[Proof]       Logo wall (if applicable) + 2-3 short testimonial pull-quotes
              + a stat strip ("17 properties built · 100% on-time delivery")

[Founder]     One paragraph about Jeremy. Photo. Link to LinkedIn.
              "Why work with one person instead of an agency?" 3 bullets.

[FAQ]         8-10 Q&A accordion. Schema.org/FAQPage JSON-LD for AI Overviews.

[Final CTA]   Big restate of "Book a call" with a sticky bottom bar on mobile.

[Footer]      Minimal. Logo. Email. LinkedIn. Status page. Privacy. Terms.
              Apollo tracking pixel disclosure (cookie consent).
```

### The lightbox

Triggered by any "Book a call" button. Tab structure inside:

```
[ Book a call ]  [ Tell me more ]  [ Email me ]
─────────────────────────────────────────────
  Tab 1 (default): Apollo Meetings embed (or custom availability picker)
                   Captures: name, email, company, 30-min slot
  Tab 2:           Typeform embed — qualified intake form
                   Captures: budget, timeline, project type, links
  Tab 3:           Single email field + "What's on your mind?" textarea
                   Lowest friction. Drops into nurture sequence.
```

On any submit: write to `leads` table + upsert Apollo contact + fire PostHog + Mixpanel + GA4 events + (if email) trigger Customer.io welcome.

## 5. The portal

Route: `/portal` (gated). Login: magic link emailed to verified address.

```
/portal/dashboard       At-a-glance: open projects, unpaid invoices, unread messages
/portal/projects        List of projects, status, last update
/portal/projects/[id]   Project detail: timeline, files, message thread
/portal/files           Flat file browser, signed-URL downloads, 3-year retention badge
/portal/invoices        Invoice list, status (paid/open/overdue), [Pay] → Stripe Checkout
/portal/messages        Threaded messages to Jeremy. Real-time-ish (poll every 30s in v1).
/portal/settings        Email, password (if set), notification prefs
```

No real-time WS in v1. No multi-user teams in v1. No invoicing-from-portal in v1.

## 6. The admin panel

Route: `/admin` (gated by `ADMIN_EMAILS` env list — Jeremy only initially).

```
/admin/dashboard        New leads, new bookings, MRR, recent activity
/admin/users            Search/filter users; click → user detail
/admin/users/[id]       Edit profile, list their projects, add a project, send invoice, message
/admin/projects         All projects across all users, sortable by status
/admin/projects/[id]    Same view as client but with edit + upload-file controls
/admin/invoices         Create invoice → generates Stripe link → emails client + portal notif
/admin/leads            Apollo-enriched lead list, source, UTM, last touch, owner
/admin/bookings         Upcoming + past bookings, sync status with Apollo / Calendar
/admin/analytics        PostHog embed + Mixpanel embed + GA4 quick stats
```

Heavy use of shadcn `<DataTable>` + Tanstack Table for the list views.

## 7. Tech stack & cost

| Layer                  | Service            | Cost                                    |
| ---------------------- | ------------------ | --------------------------------------- |
| Hosting                | Vercel             | $0–20/mo (Hobby or existing Pro)        |
| Auth + DB + Storage    | Supabase           | Free tier likely sufficient             |
| Booking                | Apollo Meetings    | Included in existing Apollo plan        |
| Lead enrichment        | Apollo             | Included                                |
| Lead form              | Typeform           | Existing plan                           |
| Email — transactional  | Resend             | Free 100/day; $20/mo at scale           |
| Email — lifecycle      | Customer.io        | Existing plan                           |
| Analytics              | PostHog            | Free up to 1M events/mo                 |
| Analytics              | Mixpanel           | Free up to 100k MTU                     |
| Analytics              | GA4                | Free                                    |
| Analytics              | GTM                | Free                                    |
| Payments               | Stripe             | 2.9% + 30¢ per transaction (no monthly) |
| Domain                 | Existing dobeu.net | Existing                                |
| **New recurring cost** | **$0**             | **All within existing plans**           |

## 8. Data model (Supabase)

```
profiles            id (uuid, FK auth.users), full_name, company, avatar_url,
                    apollo_contact_id, is_admin, created_at

projects            id, owner_user_id, title, description, status (proposed/active/
                    delivered/closed), started_at, delivered_at, total_cents, stripe_link

project_files       id, project_id, storage_path, filename, mime, size_bytes,
                    uploaded_by, uploaded_at, retention_until (now + 3 years)

invoices            id, project_id, amount_cents, currency, status (open/paid/void),
                    stripe_invoice_id, stripe_payment_intent, due_date, paid_at

messages            id, thread_id (project_id), from_user_id, to_user_id, body,
                    read_at, created_at

leads               id, email, name, company, apollo_contact_id, source (book/form/
                    email/typeform), utm_*, referrer, first_seen, last_seen,
                    raw_payload (jsonb)

bookings            id, lead_id, scheduled_at, duration_minutes, meeting_url,
                    apollo_meeting_id, status (scheduled/completed/cancelled/noshow)

page_events         id, session_id, user_id (nullable), event_name, properties (jsonb),
                    page_path, occurred_at      ← lightweight analytics mirror
```

RLS rules:

- `profiles`: user can read+update own row; admin reads all.
- `projects`/`project_files`/`invoices`/`messages`: user reads where `owner_user_id = auth.uid()`; admin reads all.
- `leads`/`bookings`/`page_events`: insert from anon (with rate limit), read admin-only.

## 9. Analytics + lead capture flow

```
Visitor lands → GTM fires → PostHog identify (anon)  +  Mixpanel anon track
              → GA4 page_view  +  PostHog $pageview
              → UTM params captured to PostHog person properties + Supabase leads draft

Lead types email into capture →
              → POST /api/lead
              → server creates Supabase leads row
              → Apollo APOLLO_CONTACTS_CREATE / UPDATE upsert (server-side, key in env)
              → PostHog identify with email
              → Mixpanel identify with email
              → Customer.io track event "lead_captured" → welcome sequence
              → GTM dataLayer.push("generate_lead") → GA4 conversion

Lead books call →
              → Apollo Meetings webhook or custom flow writes to Supabase bookings
              → Apollo activity logged
              → PostHog event "booking_scheduled"
              → Confirmation email via Resend
              → Reminder email 24h before via Customer.io
```

## 10. Theme & visual direction

**Light mode (default for marketing — bright, confident)**

- Surface: `#FAFAFC`
- Text: `#1A1A2E`
- Brand: `#6B5CE7` (indigo)
- Accent: `#F4A261` (amber)
- Subtle gradient hero: `linear-gradient(135deg, indigo-100 0%, paper-50 60%, amber-100 100%)`

**Dark mode (default for portal — focused, easy on eyes)**

- Surface: `#1A1A2E`
- Text: `#FAFAFC`
- Brand: same indigo
- Accent: same amber
- Subtle gradient: ink-900 → indigo-900 spot light

**System** — follows OS preference. Persists choice via next-themes localStorage.

**Type scale** (Nunito):

- Display (hero): 64/72/80 (mobile/tablet/desktop)
- H1: 40/48/56
- H2: 32/36/40
- Body: 16/16/18
- Small: 14

**Motion** — Framer Motion. Subtle. Hero text fades + rises 8px on load. Sections fade-in on scroll (`whileInView` once). No parallax. Lightbox: scale 0.96 → 1 + fade.

## 11. SEO + AI search optimization

- Server-rendered HTML (RSC) so crawlers and LLM scrapers see content immediately.
- `next/metadata` per page; OG image generated via `next/og`.
- `app/sitemap.ts` and `app/robots.ts` auto-generated.
- JSON-LD: `Organization`, `WebSite`, `FAQPage`, `BreadcrumbList`, `Person` (for the founder section).
- `llms.txt` at root — emerging AI-citation standard.
- Headings, alt text, focus order verified by axe in CI.
- Open Graph card auto-generated from page title + indigo+amber gradient.

## 12. Verification gates (before DNS cutover)

1. **Build**: `pnpm build` exits 0. Zero TS errors. Zero ESLint errors.
2. **Tests**: Vitest unit tests (≥80% on `/lib`) + Playwright E2E for the four happy paths (book / form / email / login).
3. **Browser walk** (Chrome DevTools MCP + Playwright): every CTA, every flow, on mobile + desktop + light + dark + system.
4. **Lighthouse**: Perf ≥90, A11y ≥95, BP ≥90, SEO ≥95 on the landing + portal dashboard.
5. **Apollo write**: end-to-end form submission produces a contact in Apollo (verified via `apollo_contacts_search`).
6. **Stripe**: test-mode invoice created and paid in portal sandbox.
7. **PostHog / Mixpanel / GA4**: dashboards each show ≥1 event from a real session.
8. **Accessibility**: axe in CI returns zero violations on landing + portal.

## 13. Out of scope (v2 backlog)

- Multi-language (ES/FR routing)
- Real-time chat (WebSocket / Pusher)
- Team accounts (multi-user per client)
- In-portal invoicing (let Stripe own this in v1)
- Public blog / case studies (Markdown collection; add later for SEO)
- Status page (external — uptime.dobeu.net)
- Native mobile app

## 14. Open questions / risks

1. **Repo strategy.** New repo `dobeutech/new-dobeu-net` is cleanest; force-pushing fresh main to `dobeutech/digital-wharf-dynamics` keeps the existing GitHub→Vercel link but loses history. _Default to new repo unless Jeremy prefers the in-place rewrite._
2. **Apollo Meetings embeddability.** Some Apollo plans expose Meetings as an embeddable widget; others as a hosted URL only. Need to verify against Jeremy's actual plan before committing. _Fallback: custom availability picker writing to Supabase + Google Calendar via OAuth (no monthly cost either)._
3. **Existing Vercel project.** The current `dobeu.net` Vercel project is connected to `dobeutech/digital-wharf-dynamics`. Switching to a new repo means creating a new Vercel project and moving the domain. ~10 min of downtime worst case if we mess up — _we'll have the new build green on `_.vercel.app` first so DNS swap is instant.\*
4. **Auth0 → Supabase migration of existing users.** The current site uses Auth0. Any existing client users will need to re-verify via magic link. _Acceptable: it's a small user base; we'll email them a heads-up before cutover._
5. **Stripe customer portability.** Existing Stripe customers stay in the same Stripe account; no migration needed. Webhook URLs need to be re-pointed at the new Vercel deployment.
6. **CSP + cookie consent.** Multiple analytics tags need explicit CSP allowances and a GDPR-compliant consent banner. _Will use the cookie-consent component pattern from the old repo, retuned for the new stack._

## 15. Next step

If approved, proceed to `PLAN.md` (phased execution) — already drafted in the same folder.
