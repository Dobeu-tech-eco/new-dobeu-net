# Estimate pipeline — Typeform intake → priced estimate

How a project intake becomes a number, and what to change when the number is wrong.

## Flow

```
Typeform "DTS Project Scope & Estimate Intake" (wKVKIBe7)
  └─ form_response webhook, HMAC-signed
     └─ app/api/typeform/webhook/route.ts
        ├─ lib/pricing/intake.ts        parse answers → contact + estimator input
        ├─ lib/leads.ts processLead()   Supabase lead + Apollo + Customer.io + email
        ├─ lib/pricing/estimate.ts      compute a banded estimate (pure)
        └─ lib/pricing/estimate-store.ts
           ├─ upsert public.estimates (dedupes on Typeform response token)
           ├─ Resend → client  (estimateToClient)
           └─ Resend → Jeremy  (estimateAdminNotification, includes review flags)
              └─ client opens /estimate/<token>
```

The form's ending screen redirects to `/estimate/next-steps`, which sets
expectations while the email is in flight. The estimate itself is never shown
inside Typeform — see "Why not Typeform's calculator" below.

## Changing prices

**Everything a client sees traces to `lib/pricing/rate-card.ts`.** Edit values
there; do not edit `estimate.ts` to change a price. The rate card carries the
2026 benchmarks each default was drawn from.

After editing, bump `RATE_CARD_VERSION`. Stored estimates record the version
they were computed under, so a rate change never silently rewrites a number
already sent to a client.

Run `pnpm test:ci -- lib/pricing` after any edit. Several tests assert that
realistic scenarios stay inside defensible market ranges, so a fat-fingered
zero fails the suite rather than reaching a client.

To see what the current card produces across ten realistic briefs, the
scenario shapes are in `lib/pricing/estimate.test.ts` under "realistic
scenarios stay in defensible ranges".

## The model

```
line items (hours × discipline rate)        →  subtotal
× 1.12 project management  × 1.10 QA        →  adjusted
× rush × compliance × rescue                →  midpoint
midpoint ± confidence spread                →  the quoted range
```

- **Hours, not dollars, are the unit of estimation.** A rate change never
  alters the scope logic.
- **The range widens with admitted uncertainty.** Each "unknown" / "not sure"
  answer counts; 0–1 → ±15%, 2–3 → ±25%, 4+ → ±35%. A discovery-only intake is
  always quoted at the widest band. A vague brief deserves a vague number.
- **Readiness gaps are not double-charged.** On the marketing track, buying
  `brand-identity` suppresses the brand-preparation line — "no brand assets" is
  the reason for the purchase, not an extra cost. Same for `website-design` and
  `content`.
- **`payments` and `esign` capabilities are zero-weighted** in
  `CAPABILITY_HOURS`; they are priced from the dedicated questions, which carry
  more signal.

## Required environment

| Var | Purpose | Consequence if unset |
| --- | --- | --- |
| `TYPEFORM_WEBHOOK_SECRET` | HMAC verification | Webhook returns 503; **no estimates at all** |
| `NEXT_PUBLIC_TYPEFORM_FORM_ID` | `wKVKIBe7` | `/estimate` shows a mailto fallback |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO` | Estimate emails | Estimate stored but never delivered |
| `VERCEL_SUPABASE_SERVICE_ROLE_KEY` | `estimates` writes and reads | Estimate emailed but not stored; `/estimate/<token>` 404s |

Every step is best-effort and independently wrapped: a Resend outage still
stores the estimate, a Supabase outage still emails it.

## Registering the webhook

Typeform's classic webhooks are not exposed through the MCP server, so this is
a manual step in the Typeform UI:

1. `admin.typeform.com/form/wKVKIBe7/connect/webhooks`
2. Endpoint: `https://dobeu.net/api/typeform/webhook`
3. Toggle **Secret** on and paste the same value as `TYPEFORM_WEBHOOK_SECRET`
   in Vercel. The route rejects every unsigned call, so a mismatch here is a
   silent total failure.
4. Send a test delivery and confirm a 200.

## Why not Typeform's calculator

Typeform supports calculator variables, and the form is even typed `quiz`. It
is still the wrong home for this pricing:

- **Nothing exists there today.** Workflow → Variables on `wKVKIBe7` has zero
  custom variables — only the three defaults (`score`, `price`, `segment`), all
  empty, with `price` gated behind a Payment question.
- **The API cannot author them.** `forms-public_get_capabilities` reports
  `logic_actions: ["jump"]` — jump is the only action available. Calculator
  rules would have to be hand-built in the editor and hand-maintained forever.
- **Forty-plus scoring inputs is not a spreadsheet problem.** The model has
  line items, two uplifts, three multipliers, confidence banding, retainer
  resolution, and budget-fit checking. It has 70 unit tests. None of that is
  expressible or testable in Typeform's variable UI.

The trade-off accepted: the client does not see a number on the ending screen.
They see it by email within minutes, with the reasoning attached — which is a
better artifact than a bare figure anyway.

## Post-migration cleanup

`lib/pricing/estimate-store.ts` exports `estimatesTable()`, which widens the
typed Supabase client so `.from("estimates")` compiles before the generated
types know the table. After running `pnpm supabase db push && pnpm db:types`,
delete that helper and call `client.from("estimates")` directly for full row
typing. It is marked `TODO(db-types)`.
