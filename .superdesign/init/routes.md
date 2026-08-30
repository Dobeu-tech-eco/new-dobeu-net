# App Router map

File-based routing under `app/`. Root layout: `app/layout.tsx` (ThemeProvider + AnalyticsProvider + CookieBanner). No `router/index.ts`.

## Public marketing

| URL | File | Layout | Renders |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | root + LightboxProvider/SiteNav/SiteFooter | Hero, SubBrandsStrip, Services, HowItWorks, Founder, FAQ, FinalCTA, StickyMobileCTA |
| `/labs` | `app/labs/page.tsx` | same marketing chrome | `LabsPage` featured experiment + demo cards |
| `/repos` | `app/repos/page.tsx` | same marketing chrome | `ReposClient` GitHub URL/shorthand viewer |
| `/login` | `app/login/page.tsx` | root only (no SiteNav) | Split brand panel + `LoginForm` magic link; `force-dynamic` |
| `/privacy` | `app/privacy/page.tsx` | `LegalLayout` | Privacy Policy prose |
| `/terms` | `app/terms/page.tsx` | `LegalLayout` | Terms of Service prose |
| `/cookies` | `app/cookies/page.tsx` | `LegalLayout` | Cookie Policy prose |
| `/optin/sms` | `app/optin/sms/page.tsx` | `LegalLayout` | SMS opt-in policy |
| `/marketing-opt-out` | `app/marketing-opt-out/page.tsx` | LightboxProvider + SiteNav/SiteFooter | Marketing opt-out form (not LegalLayout) |

## Sitemap / robots

| Generated path | Source |
| --- | --- |
| `/sitemap.xml` | `app/sitemap.ts` — `/`, `/login`, `/privacy`, `/terms`, `/cookies`, `/optin/sms`, `/marketing-opt-out`, `/repos`, `/labs` |
| `/robots.txt` | `app/robots.ts` — allow `/`; disallow `/portal`, `/admin`, `/api`, `/auth`; sitemap + host from `getSiteUrl()` |

## Auth-gated (brief)

- **`/portal/*`** — `app/portal/layout.tsx`. Cookie-bound Supabase session required; unauthenticated → `/login?next=/portal`. Sidebar: Dashboard, Projects, Tickets, Files, Invoices, Assets, Settings. Routes: `/portal`, `/portal/projects`, `/portal/projects/[id]`, `/portal/tickets`, `/portal/tickets/[id]`, `/portal/files`, `/portal/invoices`, `/portal/assets`, `/portal/settings`, `/portal/settings/mfa`.
- **`/admin/*`** — `app/admin/layout.tsx`. Same session + `isAdminEmail(user.email)` (`ADMIN_EMAILS`); non-admin → `/portal?error=not_authorized`. MFA AAL2 required (else `/portal/settings/mfa?next=/admin`). Sidebar: Overview, Users, Companies, Projects, Tickets, Invoices, Intakes, Leads, Bookings, Analytics. `force-dynamic`; most reads use `createAdminClient()` (service role).
- **`/company/*`** — `app/company/layout.tsx`. Logged-in + company_admin rank ≥ 100. `/company`, `/company/members`.
- **`/auth/callback`** — `app/auth/callback/route.ts` (Supabase magic-link). Disallowed in robots.

## Other (not marketing UI)

API under `app/api/*` (lead, webhooks, github, files, agent, intercom, cron). `/oci` is a separate Vercel container service (middleware matcher skips it).
