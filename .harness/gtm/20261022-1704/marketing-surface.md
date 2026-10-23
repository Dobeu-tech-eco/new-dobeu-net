# Marketing surface scout

Native explore adaptation of installed DTS2 scout; read-only. 707 tracked files, 130175 LOC, 26 modules, tier M. One root Next application; repo-size monorepo=true is contradicted by repository structure. Vercel detected from vercel.json; no deployment checks executed.

Surfaces: app/page.tsx; app/about/page.tsx; app/services/**; app/process/page.tsx; app/pricing/page.tsx; app/website-package/page.tsx; app/case-studies/**; app/labs/page.tsx; app/repos/**; app/{privacy,terms,cookies,marketing-opt-out,optin/sms}; metadata in app/layout.tsx, app/sitemap.ts, app/robots.ts, app/opengraph-image.tsx, public/llms.txt, lib/marketing-schema.ts.

Intake: components/landing/{Hero,LeadForm,BookingTab,TypeformTab,FinalCTA,EstimateCtas}; app/api/lead; lib/leads.ts; lib/resend-templates.ts. Lead form, booking and email are separate; optional Typeform detail intake. No public product signup assumed: login serves existing portal/company accounts.

Key tension to inspect: website-package retains fixed-price sales funnel despite collaboration homepage; pricing/services retain paid-build scope, and site-wide professionalServiceJsonLd frames a service provider. Product links and vague founder data are in lib/jeremy-data.ts. Coexisting .omc/.impeccable/.agent/.agents and agent guides preserved. Extensive pre-existing dirty work preserved.
