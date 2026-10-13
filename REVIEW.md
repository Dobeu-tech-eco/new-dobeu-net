# Review rules

Claude Code Review reads this file alongside `CLAUDE.md`. The hand-written rules are yours to edit.
The section between the `review-learning` markers is maintained by
`.github/workflows/review-learning.yml`: once a week it looks at which of last week's Claude review
comments were fixed and which were ignored, and opens a PR that updates it. Edit or reject that PR
like any other; nothing in it lands without a merge.

## Always check

- `/admin/*` pages and server actions are gated by `isAdminEmail()` / `requireAdmin()`. Most admin
  reads use `createAdminClient()` (service role), so RLS is not the enforcement layer there.
- `createAdminClient()` is only used server-side, never imported into a `"use client"` module.
- `/admin/*` and `/api/lead` keep `export const dynamic = "force-dynamic"`.
- Webhooks verify their signature before trusting the payload (Calendly HMAC, Typeform secret,
  Stripe `STRIPE_WEBHOOK_SECRET`), and the Stripe webhook stays `runtime = "nodejs"`.
- New lead entry points go through `processLead()` in `lib/leads.ts`, and each fan-out step stays
  non-fatal.
- Any new third-party script, embed or API host is added to the matching CSP array in
  `next.config.ts`.
- Analytics stays consent-gated: nothing loads or tracks before `initAnalytics(consent)`.
- Server actions in `lib/actions/*` return the `{ ok: true, data } | { ok: false, error }` shape.
- API inputs are validated with Zod.
- No `next.config.js` is added (it would shadow `next.config.ts` and its security headers).
- No `runtime = "edge"` on static metadata routes (OG images, sitemap, robots).

## Stop flagging

- Hand edits to generated files are not expected: `lib/database.types.ts` (regenerate with
  `pnpm db:types`) and `components/ui/**` (shadcn primitives).
- The in-memory rate-limit fallback when Upstash env vars are absent is intentional.
- `productionBrowserSourceMaps` is intentional; `scripts/upload-sourcemaps.mjs` deletes the maps
  after uploading them to Datadog.
- Each analytics provider being skipped when its `NEXT_PUBLIC_*` key is unset is intentional.

<!-- review-learning:start -->

## Learned from past reviews

No weekly run has happened yet.

<!-- review-learning:end -->
