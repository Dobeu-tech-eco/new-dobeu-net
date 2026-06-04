# dobeu.net v3 — Status as of 2026-05-21 22:46

## ✅ Done (everything heavy)

| | |
|---|---|
| **Stack scaffolded** | Next.js 15.5.18 + TypeScript + Tailwind + shadcn/ui + Framer Motion |
| **Brand v2 tokens** | Indigo `#6B5CE7` + Amber `#F4A261` + Ink `#1A1A2E` + Paper `#FAFAFC`, Nunito + Quicksand via `next/font` |
| **Themes** | Light / Dark / System via `next-themes` (verified — toggle hydrates correctly) |
| **Landing page** | Hero, Services (4 tiles + "Something else"), HowItWorks, Proof, Founder, FAQ + JSON-LD, FinalCTA, sticky mobile CTA, footer — all rendering at `localhost:3000` |
| **Calendly lightbox** | `react-calendly` InlineWidget pointed at your existing `https://calendly.com/jeremyw-dobeu-r_el` (free tier). Fires `calendly_*` funnel events. Mirrors bookings to `/api/lead`. CSP allows Calendly origins. **Verified open + iframe loads** |
| **Hydration** | Fixed — removed `useSearchParams` (was forcing a stuck Suspense in Next 15.5 streaming) + switched dev off Turbopack |
| **Auth + portal + admin** | All routes scaffolded — `/login` magic-link, `/portal/*`, `/admin/*` gated by `ADMIN_EMAILS=jeremyw@dobeu.net`, middleware bails gracefully when Supabase env vars are missing |
| **`/api/lead` endpoint** | Lead fan-out: Supabase insert → Apollo contact upsert → Customer.io identify + `lead_captured` event → Resend confirmation email → admin notification. IP rate-limit 5/min. |
| **Customer.io wired** | `lib/customerio.ts` server-side wrapper. Every lead identifies the contact + fires `lead_captured` event → kicks off your Customer.io welcome sequence |
| **Apollo wired** | Server-side `lib/apollo.ts` upserts contact on every lead with UTM labels |
| **Analytics fan-out** | PostHog + Mixpanel + GA4 + GTM with consent-gated banner |
| **SEO** | sitemap.ts, robots.ts (allows GPTBot/ClaudeBot/PerplexityBot), opengraph-image.tsx (edge runtime gradient), llms.txt, FAQPage + Organization JSON-LD |
| **Privacy + Terms pages** | Rendered |
| **Vercel security headers** | CSP allows Stripe, Calendly, Typeform, Apollo, Supabase, PostHog, Mixpanel, GA4, GTM; HSTS, X-Frame-Options=DENY, etc. |
| **GitHub repo** | `https://github.com/dobeutech/new-dobeu-net` — initial scaffold + hydration fixes pushed (commits `41d64a0`, `38e7e67`). Latest Customer.io commit `eda378e` committed locally, needs `git push`. |
| **pnpm 11 migration** | `pnpm-workspace.yaml` allowBuilds for sharp/esbuild/core-js/protobufjs/unrs-resolver. Postinstall scripts ran. |
| **CVE-2025-66478** | Patched — next bumped from 15.1.4 → ^15.5.4 |
| **Supabase identified** | `db-dobeutech-unified` (project ref `qdwvcrmdqweojverdmmz`) — already has projects/services/messages/contact_submissions/client_files tables from the old site. Will reuse existing schema instead of creating duplicates. |

## ⏳ Remaining (4 things — ~20 min total)

### 1. Push the latest commit (10 seconds)

```powershell
cd C:\Users\jswil\repos\new-dobeu-net
git push
```

This pushes commit `eda378e` (Customer.io integration) to `dobeutech/new-dobeu-net`.

### 2. Create the Vercel project linked to the repo (5 min)

Easiest: in your browser open https://vercel.com/new and click **Import** on the `dobeutech/new-dobeu-net` repo. Vercel auto-detects Next.js. Hit **Deploy**.

Or via CLI from the project root:
```powershell
cd C:\Users\jswil\repos\new-dobeu-net
npx vercel@latest link --yes --scope dobeutechnology
npx vercel@latest deploy --scope dobeutechnology
```

### 3. Set Vercel env vars (5 min)

In the Vercel project settings → Environment Variables, add (mark as "Production, Preview, Development"):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://new-dobeu-net.vercel.app` (or the actual URL Vercel assigns) |
| `NEXT_PUBLIC_CALENDLY_URL` | `https://calendly.com/jeremyw-dobeu-r_el` |
| `ADMIN_EMAILS` | `jeremyw@dobeu.net` |
| `NEXT_PUBLIC_VERCEL_SUPABASE_URL` | `https://ipmjokuezeuukhrilduq.supabase.co` (auto-managed by Vercel Marketplace; mirror of `VERCEL_SUPABASE_URL` for browser exposure) |
| `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY` | (auto-provisioned by Vercel Marketplace Supabase integration) |
| `VERCEL_SUPABASE_URL` | `https://ipmjokuezeuukhrilduq.supabase.co` (server-only, auto-managed) |
| `VERCEL_SUPABASE_SERVICE_ROLE_KEY` | (auto-provisioned by Vercel Marketplace Supabase integration; bypasses RLS — server only) |
| `APOLLO_API_KEY` | (your Apollo key) |
| `RESEND_API_KEY` | (your Resend key) |
| `RESEND_FROM_EMAIL` | `hello@dobeu.net` |
| `RESEND_REPLY_TO` | `jeremyw@dobeu.net` |
| `CUSTOMERIO_SITE_ID` | (your Customer.io site id) |
| `CUSTOMERIO_API_KEY` | (your Customer.io API key) |
| `NEXT_PUBLIC_POSTHOG_KEY` | (optional, your PostHog key) |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | (optional) |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | (optional, `G-...`) |
| `NEXT_PUBLIC_GTM_ID` | (optional, `GTM-...`) |
| `STRIPE_SECRET_KEY` | (when you wire portal payments) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | (when you wire portal payments) |

Then click **Redeploy** so Vercel picks them up.

### 4. DNS cutover (when you're ready)

Once `*.vercel.app` looks good:
1. In Vercel project → Domains → Add `dobeu.net` + `www.dobeu.net`
2. Update Cloudflare DNS records as Vercel instructs (apex → `76.76.21.21`, www → `cname.vercel-dns.com`)
3. ~5 min propagation, then `https://dobeu.net` is live on the new stack

## Quick-test checklist on the preview URL

- [ ] Hero loads with both CTAs visible
- [ ] "Book a call" opens lightbox → Calendly widget renders (themed light/dark)
- [ ] Submit a real test booking on Calendly → confirm Apollo gets the contact + Customer.io fires `lead_captured`
- [ ] Theme toggle cycles Light/Dark/System and persists across reloads
- [ ] FAQ accordion expands
- [ ] Lighthouse mobile: Perf ≥90, A11y ≥95, BP ≥90, SEO ≥95
- [ ] `/login` magic-link sends an email
- [ ] `/portal` redirects to login if not authed
- [ ] `/admin` redirects to `/portal?error=not_authorized` if email ≠ `jeremyw@dobeu.net`

## What was hard

- **pnpm 11 migration** — config moved from `package.json` `"pnpm": {}` to `pnpm-workspace.yaml` `onlyBuiltDependencies` / `allowBuilds`. Initial install failed; fixed.
- **Hydration mismatch** — `useSearchParams` inside `<Suspense>` boundary streamed but never resolved B:1→S:1 in Next 15.5 + Turbopack streaming. Rewrote AnalyticsProvider to read `window.location.search` directly. Switched dev off Turbopack for stability.
- **Vercel UI Deploy button** — clicked via MCP but didn't fire; UI form has React-controlled state that needed manual focus. Worked around with CLI but CLI hit 2FA gate. Recommend manual UI deploy from your browser.

## Files added/changed this session

```
new-dobeu-net/
├─ BRAINSTORM.md, PLAN.md, README.md, STATUS.md (this file)
├─ .env.local, .env.example
├─ package.json, tsconfig.json, next.config.ts, tailwind.config.ts, postcss.config.mjs, vercel.json
├─ pnpm-workspace.yaml (pnpm 11 allowBuilds)
├─ middleware.ts (auth gating)
├─ app/
│  ├─ layout.tsx, page.tsx, globals.css (Dobeu v2 tokens)
│  ├─ login/, auth/callback/, portal/(7 routes), admin/(7 routes)
│  ├─ api/lead/route.ts (Supabase + Apollo + Customer.io + Resend fan-out)
│  ├─ sitemap.ts, robots.ts, opengraph-image.tsx
│  └─ privacy/, terms/
├─ components/
│  ├─ brand/DobeuMark.tsx
│  ├─ landing/ (Hero, Services, HowItWorks, Proof, Founder, FAQ, FinalCTA, SiteNav, SiteFooter, StickyMobileCTA, LightboxProvider, BookingTab, TypeformTab, LeadForm)
│  ├─ portal/LogoutButton.tsx
│  ├─ theme-provider.tsx, theme-toggle.tsx, analytics-provider.tsx
│  └─ ui/ (button, dialog, tabs, input, label, accordion, dropdown-menu)
├─ lib/
│  ├─ supabase/ (client, server, middleware, admin)
│  ├─ analytics.ts (PostHog + Mixpanel + GA4 + GTM fan-out)
│  ├─ apollo.ts (server-side upsert)
│  ├─ customerio.ts (server-side identify + track)
│  ├─ utils.ts, database.types.ts
├─ supabase/migrations/20260521000000_initial_schema.sql (NOT applied — db-dobeutech-unified already has equivalent tables)
├─ public/llms.txt
├─ docs/DEPLOYMENT.md, FIX-INSTALL.md, tracking-plan.md
├─ start-dev.cmd, init-github.cmd, deploy-vercel.cmd, commit-fixes.cmd, commit-push.cmd
└─ .agent/progress.md, state.json, tasks.json
```

98 files total. Local dev verified working at http://localhost:3000.
