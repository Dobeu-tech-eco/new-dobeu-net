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
