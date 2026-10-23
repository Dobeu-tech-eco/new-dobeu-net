# Step 3 — SEO audit

Completed 2026-10-22; installed seo-audit 2.2.2 within marketing-skills 2.13.0. Inputs: approved Topology/P1/P6 criteria, marketing-surface.md, product-marketing-context.md and step 2 analogue findings. Source-only audit of the current dirty tree; no rendered DOM, Search Console, production crawl, field performance or ranking measurements. No claim that structured data is absent or that live SEO passes.

## Executive summary
Basic discoverability is represented in source: page canonicals, a generated sitemap, robots policy, Open Graph and JSON-LD. Rebrand consistency and actual rendered/deployed verification remain open. No demonstrated critical indexing failure was found; lack of evidence is not failure.

## Findings and priorities
| Priority / impact | Issue and evidence | Recommendation / check |
|---|---|---|
| P1 / medium positioning impact | Homepage imports ProfessionalService JSON-LD (`app/page.tsx:14,26`); `lib/marketing-schema.ts:18-36` adds service type and priceRange to broad identity pages. Visible homepage foregrounds personal collaboration. | Review entity typing and limit service offers to pages that actually describe paid work; retain truthful Organization/Person graph. This is a positioning mismatch risk, not a proven schema error or ranking penalty. Render and validate after any change. |
| P1 / launch evidence gap | Sitemap and metadata exist in source, but current production canonical host, response status, generated sitemap and actual indexability were not checked. | Before release, inspect representative rendered URLs, canonical/robots tags, JSON-LD and sitemap response; compare with Search Console when authorized. |
| P2 / content trust | `app/website-package/page.tsx:25-40,79-86` retains a $2,995/three-week offer and stack-led sales copy. It is deliberately noindex/no-follow and omitted from sitemap. | Keep intentional index policy; align public promises with approved optional paid-build positioning and confirm the offer remains supportable. Noindex does not remove a public page from the rebrand audit. |
| P2 / policy validation | `app/robots.ts` has a general private-path disallow group and separate named crawler allow groups. | Review generated per-agent rules deliberately. Robots rules are not access control; retain auth guards. Do not remove internal crawler names solely for containing AI terminology. |
| P2 / measurement gap | No Search Console query/traffic/CTR baseline or field Core Web Vitals retrieved. | Record unavailable. Do not promise ranking lifts or set fabricated conversion targets. |

## Source positives
`app/layout.tsx:39-68` has rebranded title/description/social metadata; `app/layout.tsx:107-159` explicitly emits WebSite/Person/Organization data. `app/sitemap.ts` builds public service/project routes from shared data. Reviewed home/about/pricing/process/services/project-detail metadata declares canonicals. Root language is English; international SEO not a current requirement. No new location pages or detailed bio are recommended.

## Prioritized action plan
1. Resolve public offer/identity consistency together with CRO and copy review.
2. Verify rendered canonical/index/schema behavior on the resulting release candidate; source checks cannot replace this.
3. Check product links and project statuses, then gather a baseline from existing authorized analytics/Search Console.
4. Consider additional project writeups only when truthful and useful; no keyword-volume or content-gap opportunity was established by this scan.

## Official evidence
[Google robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro) explains that crawling restrictions do not guarantee exclusion from search or protect private content. [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) require content alignment and do not guarantee rich results. Retrieved 2026-10-22. Framework source is Next.js 16 application source; runtime output not verified here.
