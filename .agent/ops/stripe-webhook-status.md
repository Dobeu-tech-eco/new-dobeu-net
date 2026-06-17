# Stripe webhook status — production

**Checked:** 2026-06-16  
**Endpoint:** `https://dobeu.net/api/webhooks/stripe`

## Automated check (no `STRIPE_SECRET_KEY` in local `.env.local`)

Stripe API / CLI verification was **not run** — `STRIPE_SECRET_KEY` is not present in the workspace `.env.local` (Vercel integration-store secrets are not mirrored locally). No keys were rotated.

## Production smoke (unsigned POST)

| Check | Result |
|-------|--------|
| `POST /api/webhooks/stripe` without `Stripe-Signature` | **400** (expected — rejects unsigned body) |

This confirms the route is live and signature verification is enforced.

## Manual verification required (operator)

1. Stripe Dashboard → **Developers → Webhooks**
2. Confirm endpoint URL: `https://dobeu.net/api/webhooks/stripe`
3. Subscribed events:
   - `invoice.paid`
   - `invoice.payment_failed`
   - `invoice.finalized`
4. Copy endpoint **signing secret** → must match `STRIPE_WEBHOOK_SECRET` in Vercel (all environments).
5. **Send test event** `invoice.paid` → expect **200** in Stripe webhook logs.
6. Optional CLI (if `STRIPE_SECRET_KEY` exported locally):

```bash
stripe webhook_endpoints list --limit 10
stripe trigger invoice.paid
```

## Related docs

- Operator checklist: `.agent/convergence/2026-06-05-production-readiness.md` §3.3
- Handler: `app/api/webhooks/stripe/route.ts`
