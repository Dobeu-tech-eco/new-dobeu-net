# Page dependency trees

Local imports only (relative + `@/` aliases). `node_modules` skipped. Type-only imports marked. Shared marketing chrome (`LightboxProvider` → `SiteNav` / `SiteFooter`) is expanded once under `/` and referenced later.

All routes also inherit `app/layout.tsx` → `components/theme-provider.tsx`, `components/analytics-provider.tsx` → `components/CookieBanner.tsx` → `hooks/use-cookie-consent.ts`, `lib/analytics.ts` → `lib/utils.ts`, `lib/datadog.ts` → `lib/datadog-redact.ts`, `components/intercom/IntercomSecureBoot.tsx` → `lib/intercom.ts`, `app/globals.css`.

## / (Home)

Entry: `app/page.tsx`

Dependencies:
- `components/landing/SiteNav.tsx`
  - `components/ui/button.tsx`
    - `lib/utils.ts`
  - `components/brand/DobeuMark.tsx`
  - `components/landing/LightboxProvider.tsx` (useLightbox; provider is ancestor)
  - `lib/jeremy-data.ts`
  - `lib/utils.ts`
  - `components/theme-toggle.tsx`
    - `components/ui/button.tsx`
    - `components/ui/dropdown-menu.tsx`
      - `lib/utils.ts`
- `components/landing/SiteFooter.tsx`
  - `components/brand/DobeuMark.tsx`
- `components/landing/Hero.tsx`
  - `components/ui/button.tsx`
  - `components/landing/HeroShaderBackground.tsx` (dynamic `@paper-design/shaders-react` — node_modules)
  - `components/landing/LightboxProvider.tsx` (useLightbox)
  - `lib/analytics.ts`
    - `lib/utils.ts` (`getPosthogHost`)
  - `hooks/use-motion-props.ts`
  - `lib/jeremy-data.ts`
  - `app/api/github-activity/route.ts` (type-only `GitHubEvent`)
- `components/landing/SubBrandsStrip.tsx`
  - `lib/jeremy-data.ts`
  - `hooks/use-motion-props.ts`
- `components/landing/Services.tsx`
  - `components/landing/LightboxProvider.tsx` (useLightbox)
  - `hooks/use-motion-props.ts`
- `components/landing/HowItWorks.tsx` (next/dynamic)
  - `hooks/use-motion-props.ts`
- `components/landing/Founder.tsx` (next/dynamic)
  - `components/brand/DobeuMark.tsx`
  - `lib/jeremy-data.ts`
  - `components/landing/LightboxProvider.tsx` (useLightbox)
  - `hooks/use-motion-props.ts`
- `components/landing/FAQ.tsx` (next/dynamic)
  - `components/ui/accordion.tsx`
    - `lib/utils.ts`
  - `lib/utils.ts` (`safeJsonLdStringify`)
  - `hooks/use-motion-props.ts`
- `components/landing/FinalCTA.tsx` (next/dynamic)
  - `components/ui/button.tsx`
  - `components/landing/LightboxProvider.tsx` (useLightbox)
  - `lib/analytics.ts`
  - `hooks/use-motion-props.ts`
- `components/landing/StickyMobileCTA.tsx` (next/dynamic)
  - `components/ui/button.tsx`
  - `components/landing/LightboxProvider.tsx` (useLightbox)
- `components/landing/LightboxProvider.tsx`
  - `components/ui/dialog.tsx`
    - `lib/utils.ts`
  - `components/ui/tabs.tsx`
    - `lib/utils.ts`
  - `components/landing/LeadForm.tsx` (next/dynamic)
    - `components/ui/button.tsx`
    - `components/ui/input.tsx`
    - `components/ui/label.tsx`
    - `lib/analytics.ts`
  - `components/landing/BookingTab.tsx` (next/dynamic)
    - `components/landing/LeadForm.tsx`
    - `lib/analytics.ts`
  - `components/landing/TypeformTab.tsx` (next/dynamic)
    - `components/ui/button.tsx`
    - `lib/analytics.ts`

## /labs

Entry: `app/labs/page.tsx`

Dependencies:
- `components/landing/SiteNav.tsx` (tree under `/`)
- `components/landing/SiteFooter.tsx` (tree under `/`)
- `components/landing/LightboxProvider.tsx` (tree under `/`)
- `components/labs/LabsPage.tsx`
  - `lib/labs-data.ts`
  - `components/labs/DemoCard.tsx`
    - `lib/utils.ts`
    - `lib/labs-data.ts` (type-only `LabDemoEntry`)
    - `components/labs/demos/index.tsx`
      - `components/ui/button.tsx`
        - `lib/utils.ts`
      - `components/landing/LightboxProvider.tsx` (useLightbox)
  - `components/labs/ExperimentSlot.tsx`
    - `components/ui/button.tsx`
    - `components/landing/LightboxProvider.tsx` (useLightbox)
    - `lib/labs-data.ts` (type-only `LabExperimentEntry`)

## /repos

Entry: `app/repos/page.tsx`

Dependencies:
- `components/landing/SiteNav.tsx` (tree under `/`)
- `components/landing/SiteFooter.tsx` (tree under `/`)
- `components/landing/LightboxProvider.tsx` (tree under `/`)
- `app/repos/ReposClient.tsx`
  - `lib/utils.ts`
  - `components/ui/button.tsx`
  - `components/ui/input.tsx`
  - `components/ui/badge.tsx`
    - `lib/utils.ts`

## /login

Entry: `app/login/page.tsx` — no SiteNav/SiteFooter; split brand panel + form.

Dependencies:
- `app/login/LoginForm.tsx`
  - `components/ui/button.tsx`
    - `lib/utils.ts`
  - `components/ui/input.tsx`
  - `components/ui/label.tsx`
  - `lib/supabase/client.ts`
    - `lib/database.types.ts` (type-only)
  - `lib/analytics.ts`
    - `lib/utils.ts`
  - `lib/utils.ts` (`buildAuthCallbackUrl`, `sanitizeNextPath`)
- `components/portal/AnalyticsSignedOut.tsx`
  - `lib/supabase/client.ts`
  - `lib/analytics.ts`
- `components/brand/DobeuMark.tsx`

## /privacy (legal)

Entry: `app/privacy/page.tsx` — representative LegalLayout page (`/terms`, `/cookies`, `/optin/sms` are the same tree).

Dependencies:
- `components/landing/LegalLayout.tsx`
  - `components/landing/SiteNav.tsx` (tree under `/`)
  - `components/landing/SiteFooter.tsx` (tree under `/`)
  - `components/landing/LightboxProvider.tsx` (tree under `/`)
