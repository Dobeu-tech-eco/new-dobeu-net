# dobeu.net v3

Next.js 15 marketing landing + minimal client portal for [Dobeu Tech Solutions](https://dobeu.net).
Built against the [Dobeu Design System v2](../dobeu-eco/figma-design/dobeu-design-system).

```
Stack:        Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui · Framer Motion
Backend:      Supabase (Auth + Postgres + Storage + RLS)
Booking:      Apollo Meetings (with custom Google-Calendar fallback)
Lead capture: Apollo upsert + Typeform + Supabase + Resend confirmation
Analytics:    PostHog + Mixpanel + GA4 + GTM (consent-gated)
Payments:     Stripe Checkout + webhooks → Supabase
Hosting:      Vercel
```

Read [`BRAINSTORM.md`](./BRAINSTORM.md) and [`PLAN.md`](./PLAN.md) before making changes — they're the
source of truth for scope, decisions, and verification gates.

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Copy env template, then fill in real values
cp .env.example .env.local

# 3. Start a local Supabase (or point at remote)
pnpm supabase start            # local Postgres + Auth via Docker
pnpm supabase db push          # apply migrations
pnpm db:types                  # regenerate lib/database.types.ts

# 4. Run dev server
pnpm dev                       # → http://localhost:3000
```

Required environment variables (see `.env.example` for the full list):

| Variable | Required for | Notes |
|---|---|---|
| `NEXT_PUBLIC_VERCEL_SUPABASE_URL` / `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY` | Everything | Auto-provisioned by the Vercel Marketplace Supabase integration. The URL alias must be added manually because Vercel ships it server-only by default. |
| `VERCEL_SUPABASE_SERVICE_ROLE_KEY` | Lead API, webhooks, admin reads | **Server only** — never expose. Auto-provisioned by the Marketplace integration. |
| `ADMIN_EMAILS` | `/admin` gating | Comma-separated. v1 default: `jeremyw@dobeu.net` |
| `APOLLO_API_KEY` | Lead capture, contact upsert | Server only |
| `NEXT_PUBLIC_APOLLO_MEETINGS_URL` | Booking lightbox | Apollo Meetings hosted URL. Leave blank for fallback flow |
| `NEXT_PUBLIC_TYPEFORM_FORM_ID` | "Tell me more" tab | Embed id of the qualified intake form |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | Product analytics | https://us.i.posthog.com (default) |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | Funnel analytics | |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Acquisition | `G-XXXXXXX` |
| `NEXT_PUBLIC_GTM_ID` | Tag orchestration | `GTM-XXXXXX` |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Invoices | |
| `STRIPE_WEBHOOK_SECRET` | `/api/webhooks/stripe` | |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `RESEND_REPLY_TO` | Transactional email | |

---

## Project layout

```
new-dobeu-net/
├─ app/
│  ├─ (root)                 ─ marketing landing page
│  ├─ login/                 ─ magic-link auth
│  ├─ auth/callback/         ─ Supabase OAuth callback
│  ├─ portal/                ─ authenticated client portal
│  │  ├─ projects/[id]/      ─ project detail + files + invoices
│  │  ├─ files/              ─ flat file browser
│  │  ├─ invoices/           ─ list + Stripe pay links
│  │  ├─ messages/           ─ thread to Jeremy
│  │  └─ settings/
│  ├─ admin/                 ─ ADMIN_EMAILS gated
│  ├─ api/
│  │  └─ lead/               ─ POST: Supabase + Apollo + Resend fan-out
│  ├─ sitemap.ts
│  ├─ robots.ts
│  ├─ opengraph-image.tsx    ─ dynamic OG card
│  └─ globals.css            ─ Dobeu DS v2 tokens
├─ components/
│  ├─ brand/                 ─ DobeuMark SVG component
│  ├─ landing/               ─ Hero, Services, Lightbox, FAQ, etc.
│  ├─ portal/                ─ LogoutButton, …
│  ├─ ui/                    ─ shadcn primitives (button, dialog, tabs, …)
│  ├─ theme-provider.tsx
│  ├─ theme-toggle.tsx       ─ Light / Dark / System
│  └─ analytics-provider.tsx ─ PostHog/Mixpanel/GA4/GTM + consent
├─ lib/
│  ├─ supabase/              ─ client/server/middleware/admin
│  ├─ analytics.ts           ─ unified fan-out
│  ├─ apollo.ts              ─ Apollo API wrapper
│  ├─ database.types.ts      ─ pnpm db:types regenerates
│  └─ utils.ts
├─ supabase/
│  └─ migrations/            ─ initial schema with RLS
├─ docs/
│  ├─ DEPLOYMENT.md          ─ Vercel + DNS cutover steps
│  └─ tracking-plan.md       ─ every analytics event documented
├─ public/
│  └─ llms.txt               ─ AI-citation metadata
├─ BRAINSTORM.md             ─ scope + decisions
├─ PLAN.md                   ─ phased implementation plan (approved)
└─ vercel.json
```

---

## Routes

| Route | Auth | Description |
|---|---|---|
| `/` | public | Marketing landing with hero, services, lightbox CTA, FAQ |
| `/privacy`, `/terms`, `/cookies` | public | Legal pages |
| `/marketing-opt-out`, `/optin/sms` | public | Consent management |
| `/repos` | public | GitHub project showcase |
| `/login` | public | Magic-link auth via Supabase |
| `/auth/callback` | public | Auth callback handler (open-redirect guarded) |
| `/portal` | required | Client dashboard |
| `/portal/projects`, `/portal/projects/[id]` | required | Project list + detail (files, invoices) |
| `/portal/files` | required | Flat file browser with signed-URL downloads |
| `/portal/invoices` | required | Invoice list + Stripe-hosted pay links |
| `/portal/tickets`, `/portal/tickets/[id]` | required | Work-order ticketing (client side) |
| `/portal/settings`, `/portal/settings/mfa` | required | Profile + TOTP MFA enrollment |
| `/admin` | admin only | Overview: leads, bookings, MRR, users |
| `/admin/leads` | admin only | Apollo-enriched lead table |
| `/admin/bookings` | admin only | Upcoming + past bookings |
| `/admin/users`, `/admin/users/[id]` | admin only | User list, edit, invite |
| `/admin/projects`, `/admin/projects/[id]` | admin only | Project CRUD |
| `/admin/invoices` | admin only | Invoice creation (Stripe-hosted) + manual-paid escape hatch |
| `/admin/tickets`, `/admin/tickets/[id]` | admin only | Work-order ticketing (admin side: quote, update status) |
| `/admin/analytics` | admin only | Site analytics overview |
| `/api/lead` | public POST | Lead capture: Supabase + Apollo + Resend fan-out (Zod-validated, rate-limited) |
| `/api/webhooks/stripe` | Stripe sig | Invoice status sync (`invoice.paid/payment_failed/finalized/voided`) |
| `/api/webhooks/calendly` | Calendly HMAC | Booking → lead pipeline |
| `/api/typeform/webhook` | Typeform HMAC | Typeform submission → lead pipeline |
| `/api/github-repo` | public GET | `/repos` data source (owner/repo validated, rate-limited) |
| `/api/agent` | admin only | Embedded Claude Agent SDK surface |

---

## Themes

`next-themes` with `attribute="class"`, `defaultTheme="system"`. Three modes:

- **Light** — paper-50 surface, ink-900 text, indigo+amber accents
- **Dark** — ink-900 surface, paper-50 text, indigo-400 + amber accents
- **System** — follows OS preference

Theme toggle lives in the nav and portal sidebar.

---

## Verification

Run before any merge to `main`:

```bash
pnpm type-check && pnpm lint && pnpm test:ci && pnpm build
```

Browser walkthrough is in [`PLAN.md`](./PLAN.md) §Phase 4. Lighthouse targets:
Perf ≥90 / A11y ≥95 / BP ≥90 / SEO ≥95 (mobile and desktop).

---

## License

Proprietary — © Dobeu Tech Solutions LLC.
