# Deployment guide — dobeu.net v3

Production target: **Vercel**, custom domain **dobeu.net** (cutover from existing Vercel project
backed by `dobeutech/digital-wharf-dynamics`).

---

## Phase 0 — Enable Claude GitHub automation

1. Install the Claude GitHub App for the `Dobeu-tech-eco` organization (or this repository only).
2. Add the repository (or organization) Actions secret:
   - `CLAUDE_CODE_OAUTH_TOKEN`
3. Claude workflows are configured in:
   - `.github/workflows/claude.yml`
   - `.github/workflows/claude-code-review.yml`
4. Open a PR to test:
   - mention `@claude` in a PR comment, or
   - rely on `Claude Code Review` running on PR `opened/synchronize/ready_for_review/reopened`.

---

## Phase 1 — Push to GitHub

```bash
# From C:\Users\jswil\repos\new-dobeu-net
git init
git add .
git commit -m "feat: initial scaffold (Phase 1 complete)"

# Create the new repo on GitHub (manually or via gh CLI)
gh repo create dobeutech/new-dobeu-net --private --source=. --remote=origin
git push -u origin main
```

If you don't have `gh` installed, create `dobeutech/new-dobeu-net` in the GitHub UI first, then:

```bash
git remote add origin git@github.com:dobeutech/new-dobeu-net.git
git push -u origin main
```

---

## Phase 2 — Provision Supabase (via the Vercel Marketplace)

Supabase is provisioned through the Vercel Marketplace integration, which auto-injects the env vars into every environment (Production / Preview / Development).

1. In the Vercel project → **Storage** → click **Connect Database** → choose **Supabase**. Vercel will provision (or link) the Supabase project and inject these env vars automatically:
   - `VERCEL_SUPABASE_URL` (server-only)
   - `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY` (browser-exposed)
   - `NEXT_PUBLIC_VERCEL_SUPABASE_PUBLISHABLE_KEY`
   - `VERCEL_SUPABASE_SERVICE_ROLE_KEY` (server-only, bypasses RLS)
   - `VERCEL_SUPABASE_JWT_SECRET`
   - `VERCEL_POSTGRES_*` (direct DB connection variants)
2. **Add one extra env var manually**: `NEXT_PUBLIC_VERCEL_SUPABASE_URL` (mirror of `VERCEL_SUPABASE_URL`) — the Marketplace integration does not ship a `NEXT_PUBLIC_` prefix on the URL, but the browser client needs it. Mark it Production + Preview + Development.
3. Apply migrations:
   ```bash
   pnpm supabase link --project-ref <your-ref>
   pnpm supabase db push
   ```
4. Enable **Email auth** in Supabase Dashboard → Authentication → Providers.
5. **Custom SMTP (Resend) for magic-link auth** — required for cutover testing at volume.
   Magic links are sent by **Supabase Auth**, not the Next.js app. `RESEND_API_KEY` in Vercel
   only powers lead/work-order emails via `lib/resend.ts`; you must wire Resend into Supabase
   separately.

   In [Supabase Dashboard](https://supabase.com/dashboard/project/ipmjokuezeuukhrilduq/auth/smtp)
   → **Authentication** → **Email** → **SMTP Settings**:

   | Field | Value |
   | ----- | ----- |
   | Enable custom SMTP | On |
   | Host | `smtp.resend.com` |
   | Port | `465` (TLS) — or `587` (STARTTLS) |
   | Username | `resend` |
   | Password | Your Resend API key (same secret as Vercel `RESEND_API_KEY`; paste in Dashboard only — never commit) |
   | Sender email | `hello@dobeu.net` (or your verified `RESEND_FROM_EMAIL`) |
   | Sender name | `Dobeu Tech Solutions` |

   Resend docs: [Send with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp).
   Domain `dobeu.net` must be verified in Resend before auth mail delivers reliably.

6. **Raise Auth rate limits** (project `ipmjokuezeuukhrilduq`) — Dashboard →
   **Authentication** → **Rate Limits**:

   | Limit | Built-in SMTP default | After custom SMTP | Suggested for cutover testing |
   | ----- | --------------------- | ----------------- | ----------------------------- |
   | Email sent (project/hour) | ~2/h (very low) | 30/h until you raise it | **100–500/h** during soak |
   | OTP / magic link (project/hour) | — | Customizable | **30–60/h** |
   | OTP per-user cooldown | ~60s | Customizable | Keep **60s** (matches `/login` client cooldown) |

   "Email rate limit exceeded" on `/login` is a **Supabase 429**, not the app's `/api/lead`
   limiter. Fixing redirect URLs alone does not change this.

   Management API (optional): `PATCH https://api.supabase.com/v1/projects/ipmjokuezeuukhrilduq/config/auth`
   with `rate_limit_email_sent`, `rate_limit_otp`, etc. — see
   [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits).

7. **Authentication → URL Configuration** (project `ipmjokuezeuukhrilduq`):
   - **Site URL:** `https://dobeu.net`
   - **Redirect URLs** (add each line):
     - `https://dobeu.net/**`
     - `https://dobeu.net/auth/callback`
     - `https://*.vercel.app/**`
     - `http://localhost:3000/**`
     - `http://localhost:3000/auth/callback`
   If Site URL is still `http://localhost:3000`, magic links fall back to localhost even when
   requested from production. After saving, request a **new** magic link (old emails keep the
   stale `redirect_to`).

**Dashboard vs automatic**

| Item | Where it lives | Operator action? |
| ---- | -------------- | ------------------ |
| Magic-link send + rate limits | Supabase Auth (`/auth/v1/otp`) | **Yes** — SMTP + Rate Limits in Dashboard |
| Lead / work-order email | Next.js + `RESEND_API_KEY` | Already in Vercel env (no Supabase step) |
| `/login` double-submit guard | `app/login/LoginForm.tsx` | **Automatic** after deploy (60s client cooldown) |
| Redirect URLs / Site URL | Supabase Auth URL config | **Yes** — one-time Dashboard setup |

---

## Phase 3 — Provision Vercel project

1. Go to https://vercel.com/new → Import `dobeutech/new-dobeu-net`.
2. Framework preset: **Next.js** (auto-detected).
3. Add environment variables from `.env.example` — copy values from Supabase, Apollo, Stripe, etc.
4. Click **Deploy**.
5. Vercel assigns a `*.vercel.app` URL. Test all flows there before swapping DNS.

---

## Phase 4 — Verify on the preview URL

Before touching DNS, walk every flow on the `*.vercel.app` preview:

- [ ] Hero loads with both CTAs visible
- [ ] Lightbox opens with all three tabs
- [ ] "Just email" submission writes to Supabase `leads` and pings Apollo
- [ ] Confirmation email arrives via Resend
- [ ] Light / Dark / System toggle works and persists
- [ ] Mobile sticky CTA appears after scroll
- [ ] FAQ JSON-LD validates at https://search.google.com/test/rich-results
- [ ] OG image renders at `https://<preview>/opengraph-image`
- [ ] Magic-link login arrives and lands user at `/portal`
- [ ] `/portal` shows empty-state cards (or seeded data)
- [ ] `/admin` redirects if email is not in `ADMIN_EMAILS`
- [ ] `/admin` loads for `jeremyw@dobeu.net`
- [ ] Lighthouse on `/` ≥ 90/95/90/95

---

## Phase 5 — DNS cutover

1. **In Vercel** (new project): Settings → Domains → Add `dobeu.net` and `www.dobeu.net`.
   Vercel will tell you the required DNS records.
2. **In Cloudflare** (or wherever DNS lives): update the `A` / `CNAME` records to point at Vercel.
   - Apex `dobeu.net` → `76.76.21.21` (Vercel anycast)
   - `www` → `cname.vercel-dns.com`
   - Set Cloudflare proxy to "DNS only" (grey cloud) during cutover; can re-enable proxy after SSL cert provisions.
3. Wait for DNS propagation (~5 min usually).
4. Vercel auto-issues SSL via Let's Encrypt.
5. Smoke test: open `https://dobeu.net` in incognito.

---

## Phase 6 — Decommission old site

1. Pause auto-deploys on the old `digital-wharf-dynamics` Vercel project (or whichever host serves it now).
2. Keep the old Netlify/Vercel site running for **7 days** in case rollback is needed.
3. Email existing client users a heads-up:

   ```
   Subject: We've rebuilt dobeu.net — re-verify with this magic link

   I rebuilt the client portal on a faster, cleaner stack. Your account moved over;
   just click the magic link below to re-authenticate.

   [magic link button]

   — Jeremy
   ```

4. After 7-day soak: archive the old repo, downgrade or delete the old hosting project.

---

## Rollback plan

If anything goes wrong post-cutover:

1. In Cloudflare DNS, revert `dobeu.net` records to old values (records preserved in DNS history).
2. Inform clients via email + status page.
3. Investigate locally on a preview deploy.
4. Re-attempt cutover only after the bug is fixed and re-verified on preview.

---

## Webhooks to update on cutover

| Service     | New URL                                     |
| ----------- | ------------------------------------------- |
| Stripe      | `https://dobeu.net/api/webhooks/stripe`     |
| Apollo      | `https://dobeu.net/api/webhooks/apollo`     |
| Resend      | `https://dobeu.net/api/webhooks/resend`     |
| Customer.io | `https://dobeu.net/api/webhooks/customerio` |

Each webhook secret should be rotated on cutover and stored in Vercel env vars.
