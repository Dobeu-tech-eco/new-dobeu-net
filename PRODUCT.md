# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary buyer is an operator whose repeating work still lives in an inbox and in spreadsheets. Dispatch is the home case. The same loop is meant to stay usable for a kitchen, a job site, or a small office. Confirmed in conversation: dispatcher-first, and cross-company on purpose.

Signed-in clients and the admin desk also exist in this app. Whether design work should treat them as the same product as the public site was asked and not answered. Inferred from the repo: they ship here, behind login.

## Product Purpose

Dobeu Tech Solutions LLC, run by Jeremy Williams in New York, takes one of those operating loops and ships it. The public site asks the visitor to book a call or send the job. "Send the job" gets a price band back, not an instant quote. A typical engagement is the published $5k–$30k band. Success on the public site is a qualified conversation that can become that engagement.

## Positioning

One operator ships the loop the buyer does not have a tool for yet: an agent that runs dispatch (or the same shape of work), an app the crew will actually open, a front door that matches the operation, or billing that goes out. A template shop and a traffic dashboard cannot truthfully make that claim. The published proof line is: prices are published, invoices go through Stripe, and the code lands in the client's repo.

## Operating Context

The buyer evaluates the offer on dobeu.net, then either books a call or sends a job through the estimate form. Work is scoped as an engagement, invoiced through Stripe, and delivered into the client's repository. The four published offers are "Dispatch that runs", "The tool you don't have", "A front door people trust", and "Invoices that go out".

## Capabilities and Constraints

The public site, client portal, and admin desk are one Next.js app. Portal and admin require a signed-in Supabase user. Admin access is an email allowlist.

Published constraints, from the site the owner directed:

- Prices stay published. Do not invent a quote machine. "Send the job" means a reply with a price band.
- Case-study numbers stay unpublished until `approved` is set on a real metric in `lib/jeremy-data.ts`. Do not invent client names, outcome figures, a street address, or a phone number.
- Dead hosts that must not appear in public chrome: dobeu.cloud, dobeutech.com, dobeu.dev.

Open: whether future design passes include the portal and admin, or only the public marketing pages.

## Brand Commitments

The live logo on https://dobeu.net stays. It is the inlined mark in `components/brand/DobeuMark.tsx` with the lowercase "dobeu.net" wordmark. Do not redraw or replace it. Confirmed by the owner.

Voice on the public site is first person, Jeremy, operator to operator. Dispatch is the concrete case. The same sentences must still make sense for a kitchen, a site, or a desk.

## Evidence on Hand

- Offer, price band, and proof line: `lib/jeremy-data.ts` (`HERO_COPY`, `PRICE_RANGE`, `GTM_PILLARS`).
- Identity: `SITE_IDENTITY` and `FOUNDER` in the same file. Legal name Dobeu Tech Solutions LLC. Email jeremyw@dobeu.net. Area served NYC and NJ metro. No street address is published.
- Shipped project names and repo links live in `SHIPPED_WORK`. Their metric lists are empty. No approved case-study numbers are on hand.
- Do not fabricate testimonials, customer logos, or benchmarks.

## Product Principles

- Dispatch is the home story. The offer still has to work for other small operators.
- Sell a scoped engagement with a published price band. Do not promise an instant quote.
- Proof has to be checkable. Unpublished metrics stay unpublished.
- The live logo is fixed. Other visual decisions can change around it.
- One operator does the work. Do not write the site as a team or an agency bench.
