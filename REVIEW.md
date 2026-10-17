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

### Always check

- Badge text, labels and `aria-label`s that sit next to status-driven styling must come from the same state (for example `AVAILABILITY.status` / `AVAILABILITY.label`). Hardcoded copy contradicts the styling when the status changes. (PR #275)
- Submit-button and confirmation copy in `LeadForm` must match what was actually submitted. Do not promise a price band or "job received" when `message` is optional and may be empty. Choose the copy by `source` (`book` vs `form`). (PR #275, #274)
- Copy, anchors and policy text that describe behavior must match the code and the section they point to. Examples are price-band timing, consent categories on the cookies page, and trust-chip anchors such as `#about`. (PR #275, #274)
- Workflow and script code that parses manual inputs such as repo lists must handle newlines, whitespace and letter case. It must validate the `owner/name` format before the value reaches shell or a matrix. Pass values through `env`, not `${{ }}` interpolation inside `run:`. (PR #278)
- Citation validation in `.github/scripts/review-learning.mjs` must check every number in a `PR #x, #y` evidence phrase and must not treat unrelated `#` values (such as `#333`) as citations. (PR #278)
- When a landing section is redesigned (for example the FAQ going from five or more items to four), check that the Playwright assertions in `e2e/smoke.spec.ts` still match the rendered markup and counts. CI runs this suite as a merge gate. (PR #280)

### Stop flagging

- Agent and tooling configuration for AI dev tools is not product code. This covers `.codex/`, `.cursor/skills/**`, `.agents/` and `.ona/config.yaml`, including hook paths, launcher file modes and task ordering. (PR #270, #232)
- JSON-LD structured data drifting from redesigned landing copy is not worth a comment. This covers a missing `FAQPage` schema and a stale default description in `professionalServiceJsonLd()`. (PR #280)

<!-- review-learning:end -->
