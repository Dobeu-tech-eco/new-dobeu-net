# Post-merge production smoke checklist

Run after merging `test/coverage` → `main` and deploying to production (`https://dobeu.net`). Combines automated curl checks with a manual Stripe-backed ticket journey (Task Group G2).

## Prerequisites

- Vercel production deploy green (`pnpm verify` passed on the merge commit).
- `STRIPE_WEBHOOK_SECRET` in Vercel matches the Stripe Dashboard endpoint for `https://dobeu.net/api/webhooks/stripe` (events: `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`).
- Phase 5 migration applied: `profiles.is_admin` dropped (`node .agent/scripts/apply-phase5-migration.mjs` → `is_admin column present: NO`).
- Test accounts: portal client user + admin email in `ADMIN_EMAILS` (admin MFA enrolled if AAL2 gate is enabled).

## A. Curl smoke (production)

Replace host if using a preview URL; production canonical host is `https://dobeu.net`.

```bash
BASE=https://dobeu.net

# Marketing / SEO
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/"
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/robots.txt"
curl -sS "$BASE/sitemap.xml" | head -20
# Expect loc URLs like https://dobeu.net/ — not http://localhost:3000

# Auth-gated routes (unauthenticated → redirect to login)
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/portal/tickets"
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/admin/tickets"
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/portal/settings/mfa"

# Stripe webhook rejects unsigned POST
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/webhooks/stripe" -H "Content-Type: application/json" -d "{}"

# Auth callback handles a (bogus) code → redirects to /login with error (route is live)
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" "$BASE/auth/callback?code=bogus&next=%2Fportal"
# Defensive forwarder: stray ?code= on root → 307 to /auth/callback
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" "$BASE/?code=bogus"
```

| Check | Expected |
| --- | --- |
| `GET /` | 200 |
| `GET /robots.txt` | 200 |
| `GET /sitemap.xml` | 200, `https://dobeu.net` in `<loc>` |
| `GET /portal/tickets` | 307/302 → login |
| `GET /admin/tickets` | 307/302 → login |
| `GET /portal/settings/mfa` | 307/302 or 200 if session cookie present |
| `POST /api/webhooks/stripe` (no signature) | 400 |
| `GET /auth/callback?code=bogus` | 307 → `https://dobeu.net/login?error=auth_callback_failed` |
| `GET /?code=bogus` | 307 → `https://dobeu.net/auth/callback?code=bogus` (forwarder) |

PowerShell (Windows):

```powershell
$Base = "https://dobeu.net"
foreach ($path in @("/","/robots.txt","/portal/tickets","/admin/tickets","/portal/settings/mfa")) {
  try { $r = Invoke-WebRequest -Uri "$Base$path" -MaximumRedirection 0 -SkipHttpErrorCheck; "$path -> $($r.StatusCode)" }
  catch { "$path -> redirect/error" }
}
Invoke-WebRequest -Uri "$Base/sitemap.xml" -UseBasicParsing | Select-Object -Expand Content | Select-String "dobeu.net"
Invoke-WebRequest -Uri "$Base/api/webhooks/stripe" -Method POST -Body "{}" -ContentType "application/json" -SkipHttpErrorCheck | Select-Object StatusCode
```

## B. Manual E2E: ticket → quote → pay → webhook

Use a **$1.00 live** invoice for the final payment check (or Stripe test mode on a preview only if keys are test).

1. **Client — submit ticket**  
   - Sign in at `/login` (magic link). If magic-link email is broken during cutover, use the
     **"Sign in with a password instead"** toggle; set a password first with
     `node scripts/set-user-password.mjs <email>` (see `docs/DEPLOYMENT.md` Phase 2 step 9).
   - If a magic link drops you on `https://dobeu.net/?code=…` (root), the middleware forwarder
     should bounce you to `/auth/callback` and complete login. Landing on `localhost` instead
     means Supabase **Site URL** is still localhost — fix it in the Dashboard (step 7).  
   - `/portal/tickets` → **New ticket** → choose service type, title, notes; attach a small file if the form allows.  
   - Submit; confirm the ticket appears in the list and detail page loads.

2. **Admin — quote**  
   - Sign in as admin (`ADMIN_EMAILS`). Complete MFA step-up if prompted.  
   - `/admin/tickets` → open the ticket → enter quote amount/description → save.  
   - Confirm status reflects “quoted” (or equivalent) in admin and portal.

3. **Client — accept quote**  
   - Portal ticket detail → **Accept** quote.  
   - Confirm status moves to accepted / awaiting invoice.

4. **Admin — Stripe invoice**  
   - Admin ticket → **Create Stripe Invoice** (or workflow that calls `acceptWorkOrderQuote` / invoice creation server actions).  
   - Confirm `hosted_invoice_url` is present on the invoice row (Supabase) and link opens Stripe hosted page.

5. **Client — pay**  
   - Open hosted invoice URL; pay with test card (test mode) or live $1 (production).  
   - Stripe Dashboard → Webhooks → endpoint logs: `invoice.paid` → **200** from `https://dobeu.net/api/webhooks/stripe`.

6. **Verify DB + UI**  
   - Invoice status `paid` in Supabase (`invoices.status`).  
   - Portal `/portal/invoices` and admin `/admin/invoices` show paid.  
   - Ticket/work-order status consistent on both surfaces.

## C. Stripe Dashboard (Task G1)

- [ ] Endpoint URL: `https://dobeu.net/api/webhooks/stripe`  
- [ ] Signing secret matches `STRIPE_WEBHOOK_SECRET` in Vercel production  
- [ ] Send test webhook `invoice.paid` → 200 in endpoint logs  

## D. Playwright (optional, against local or staging)

With Supabase E2E env in `.env.local`:

```bash
pnpm test:e2e -- e2e/tickets.spec.ts
```

Covers client ticket submit only; full pay path remains manual above.

## Rollback notes

- If webhook signature mismatches, payments succeed in Stripe but app invoice rows stay unpaid — fix secret first, then replay events from Stripe Dashboard.  
- If `profiles.is_admin` still exists, run Phase 5 migration before relying on `ADMIN_EMAILS`-only admin gate documentation.
