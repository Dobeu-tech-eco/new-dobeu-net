# Phase 5 migration apply blocker (2026-06-16)

**Migration:** `supabase/migrations/20260616000000_phase5_drop_is_admin.sql`  
**Goal:** `profiles.is_admin` column removed (`ADMIN_EMAILS` is the sole admin gate).

## What blocked automated apply (Task Group G)

1. `vercel env pull .env.local --environment=production` ran successfully but **`VERCEL_POSTGRES_URL_NON_POOLING` remained empty** (along with `VERCEL_SUPABASE_URL` / `VERCEL_SUPABASE_SERVICE_ROLE_KEY` in the pulled file). Only `VERCEL_OIDC_TOKEN` was updated on re-pull.
2. `pnpm supabase db push --linked` is not available without `supabase login` / `SUPABASE_ACCESS_TOKEN`.
3. Read-only verification via Postgres was therefore **not run** in this session.

## Operator command (when Postgres URL is available)

Populate `.env.local` with a direct Postgres connection string (Vercel Supabase integration often exposes this as `POSTGRES_URL_NON_POOLING` or `VERCEL_POSTGRES_URL_NON_POOLING` in the Vercel dashboard — copy into `.env.local` as `VERCEL_POSTGRES_URL_NON_POOLING`).

```bash
# Inspect (no writes)
node .agent/scripts/apply-phase5-migration.mjs

# Apply + verify
node .agent/scripts/apply-phase5-migration.mjs --apply
```

Expected after apply: `is_admin column present: NO`.

## Alternative: Supabase CLI (linked project)

```bash
supabase login
pnpm supabase link --project-ref <ref>
pnpm supabase db push
```

## SQL (manual, Supabase SQL editor)

```sql
alter table public.profiles drop column if exists is_admin;
```

Verify:

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin';
-- expect 0 rows
```
