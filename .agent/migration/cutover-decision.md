# Legacy cutover decision — `db-dobeutech-unified` → Vercel Supabase

**Date:** 2026-06-17  
**Inventory:** [`.agent/migration/inventory.md`](inventory.md) (§1–§3, §3b, §8, bonus)  
**Target:** Vercel Marketplace Supabase `ipmjokuezeuukhrilduq` (already live for `https://dobeu.net`)

---

## Decision: **A — No data migration** (public tables)

Vercel-managed Supabase remains the **source of truth**. Do **not** run
`mapping.sql` data inserts, staging restore, or storage copy for portal tables.

### Why not B (minimal auth import) or C (selective migration)?

| Factor | Finding | Implication |
|---|---|---|
| Portal files | `client_files` count = **0** | No `project_files` / storage migration |
| Leads | `contact_submissions` = **0**; no `leads` / `dobeu_net_leads` | No lead dedupe or mapping |
| v3 business tables | `invoices`, `leads`, `bookings` **absent** on legacy | No invoice/booking migration |
| Chat | `messages` exists on legacy; v3 **dropped** `messages` | Intercom owns support — skip |
| Platform noise | 30 public tables; `composio_tools` ≈ 3072 rows | Full dump would pollute target |
| Auth | `auth.users` = **3** | Only legacy artifact worth knowing about |
| App auth model | Magic-link only | Passwords never migrate; users re-auth on first visit |
| FK surface | Zero portal rows | No dependency on preserving legacy user UUIDs |

**B (minimal auth import)** is optional operator convenience — pre-create the 3
accounts on target without waiting for organic sign-in. It does **not** change
the NO-OP stance for `public.*` data. Script:
[`.agent/migration/import-auth-users.mjs`](import-auth-users.mjs) (skeleton; do
not run without credentials).

**C (full selective migration)** is **rejected** — no rows to move; cost/risk
exceeds benefit.

---

## Operator sequence

### 1. Confirm the 3 legacy emails

Run on **legacy** `db-dobeutech-unified` (Supabase Studio SQL Editor):

```sql
select id, email, created_at
from auth.users
order by created_at;
```

Do **not** commit output to git. Compare against who should have portal access
on `https://dobeu.net`.

### 2. Choose auth path

| Path | When to use | Action |
|---|---|---|
| **Organic (default)** | Users can receive a magic link on first login | Nothing — `handle_new_user` creates `profiles` on sign-in |
| **Pre-seed (optional)** | Operator wants accounts present before first visit | Run `import-auth-users.mjs` against legacy + target service role (see script header) |

Communicate: **passwords do not carry**; everyone re-verifies via magic link.

### 3. Skip data cutover window

No write freeze required for data migration (target already authoritative).
Optional: disable Calendly webhook only if doing a maintenance banner — not
required for empty legacy portal data.

### 4. Post-merge smoke

Walk [`scripts/post-merge-smoke.md`](../../scripts/post-merge-smoke.md) on
production.

### 5. Retire legacy

After smoke passes:

1. Set `db-dobeutech-unified` to **read-only** (pause writes / restrict keys) —
   7-day soak per production-plan §6.3 step 9.
2. Confirm no other services still point connection strings at legacy.
3. **Pause or delete** the legacy Supabase project when soak completes.

**Can legacy be paused now?** **Yes**, for dobeu.net v3 purposes — live app
already reads Vercel Supabase; legacy holds no portal rows. Keep read-only
briefly only if other unified-platform consumers still use the same project;
otherwise retire after email list is archived.

---

## Artifacts

| File | Status |
|---|---|
| `mapping.sql` | **NO-OP** for data tables (comments only) |
| `import-auth-users.mjs` | Optional skeleton — auth pre-seed only |
| `restore-staging.sql` | **Not needed** for this cutover path |
| `cutover-execute.md` | Superseded for data steps; smoke + retire still apply |

---

## SQL reference (operator — legacy DB)

```sql
-- List 3 auth user emails (do not commit results)
select id, email, created_at from auth.users order by created_at;

-- Optional: check legacy public.profiles if bonus query showed profiles exists
-- select count(*) from public.profiles;
```
