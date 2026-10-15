# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary buyer is a small-business owner or operations lead whose day-to-day work is harder to run because existing tools leave gaps. They need clearer responsibilities, dependable records, and better coordination between the field and back office. Small fleets are the flagship example, not the limit of the business. Confirmed by the owner: tailored operational software for small businesses, rather than dispatch-first agent services.

Signed-in clients and the admin desk also exist in this app. Whether design work should treat them as the same product as the public site was asked and not answered. Inferred from the repo: they ship here, behind login.

## Product Purpose

Dobeu Tech Solutions LLC, run by Jeremy Williams in New York, designs and builds tailored systems around how a business actually operates. The goal is to help people work safely, keep responsibilities clear, and spend less time chasing information. These are intended benefits, not measured outcome claims. Success on the public site is a qualified conversation about a real operational problem that can become a scoped engagement. The existing published typical engagement band is $5k–$30k; inquiries receive a considered response, not an instant quote.

## Positioning

Dobeu is a custom operational software partner, not a general IT reseller, template shop, or instant AI-tool generator. Understand the operation and its constraints first; select technology to fit the problem. Work includes understanding real workflows, exceptions, integrations, and ownership—not simply generating a small tool. Technology is a means, not the product promise.

RouteReady (https://routereadyhq.com) is the flagship example: a concrete solution for small-fleet driver training and readiness. It demonstrates the kind of tailored operational work Dobeu can provide without restricting the business to fleets. Do not imply verified safety improvements, adoption, or customer results without supporting evidence.

## Operating Context

The buyer evaluates Dobeu on dobeu.net and describes what is difficult today, who is affected, and what better would look like, or books a conversation. The established inquiry and booking flows remain in place. Work is scoped as an engagement, invoiced through Stripe, and delivered into the client's repository. The approach is to understand the operation, design around its constraints, then build and support the system. Earlier dispatch/agent-led offer labels are legacy messaging, not the current positioning.

## Capabilities and Constraints

The public site, client portal, and admin desk are one Next.js app. Portal and admin require a signed-in Supabase user. Admin access is an email allowlist.

Published constraints, from the site the owner directed:

- Prices stay published. Do not invent a quote machine. "Send the job" means a reply with a price band.
- Case-study numbers stay unpublished until `approved` is set on a real metric in `lib/jeremy-data.ts`. Do not invent client names, outcome figures, a street address, or a phone number.
- Dead hosts that must not appear in public chrome: dobeu.cloud, dobeutech.com, dobeu.dev.

Open: whether future design passes include the portal and admin, or only the public marketing pages.

## Brand Commitments

The live logo on https://dobeu.net stays. It is the inlined mark in `components/brand/DobeuMark.tsx` with the lowercase "dobeu.net" wordmark. Do not redraw or replace it. Confirmed by the owner.

The established voice is Jeremy, operator to operator: direct, plainspoken, and grounded in the buyer's work. Lead with what the business gains, not AI, automation, or IT-service buzzwords. RouteReady is the concrete example; broader messaging must remain applicable to other small businesses. Preserve the factual single-operator identity rather than inventing a team.

## Evidence on Hand

- Offer, price band, and proof line: `lib/jeremy-data.ts` (`HERO_COPY`, `PRICE_RANGE`, `GTM_PILLARS`).
- Identity: `SITE_IDENTITY` and `FOUNDER` in the same file. Legal name Dobeu Tech Solutions LLC. Email jeremyw@dobeu.net. Area served NYC and NJ metro. No street address is published.
- Shipped project names and repo links live in `SHIPPED_WORK`. Their metric lists are empty. No approved case-study numbers are on hand.
- Do not fabricate testimonials, customer logos, or benchmarks.

## Product Principles

- Start with the operational problem and the buyer's benefit, not a technology category.
- Build around real workflows and constraints; do not promise instant tool generation or an instant quote.
- Use RouteReady as concrete evidence of the approach, not a fleet-only boundary or unsupported results claim.
- Keep proof checkable, pricing truthful, and ownership clear. Do not invent metrics, customers, testimonials, or a team.
- Preserve the established logo and single-operator identity.

## Accessibility & Inclusion

Public interfaces must meet WCAG AA contrast requirements, support keyboard navigation and visible focus, provide appropriate image alternatives, and respect reduced-motion preferences. Mobile web is part of the web platform, not a separate native product.
