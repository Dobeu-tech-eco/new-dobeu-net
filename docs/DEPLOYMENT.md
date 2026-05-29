# Deployment guide — dobeu.net v3

Production target: **Vercel**, custom domain **dobeu.net** (cutover from existing Vercel project
backed by `dobeutech/digital-wharf-dynamics`).

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

## Phase 2 — Provision Supabase

1. Go to https://supabase.com/dashboard → Create new project.
   - Project name: `dobeu-net-v3`
   - Region: `us-east-1` (matches Vercel `iad1`)
   - Database password: generate + store in 1Password
2. Once provisioned, copy from **Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`
3. Apply migrations:
   ```bash
   pnpm supabase link --project-ref <your-ref>
   pnpm supabase db push
   ```
4. Enable **Email auth** in Supabase Dashboard → Authentication → Providers.
5. Set redirect allowlist: `https://dobeu.net/auth/callback`, `https://*.vercel.app/auth/callback`,
   `http://localhost:3000/auth/callback`.

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
