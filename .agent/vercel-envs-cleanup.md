# Vercel env cleanup — legacy `NEXT_PUBLIC_SUPABASE_*` removal

**Date:** 2026-06-04 (Phase 2)
**Operator:** Cursor agent (Phase 2 execution)

## Justification

`grep` across the entire repo (excluding `.agent/` migration logs and `.next/`
build artifacts) returns ZERO references to either:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

All Supabase access flows through the Vercel-Marketplace-provisioned
`NEXT_PUBLIC_VERCEL_SUPABASE_*` / `VERCEL_SUPABASE_*` envs. The two legacy
keys were holdovers from an earlier (pre-Marketplace) wiring and were
safe to delete.

## What was removed

| Env name                          | Targets removed         |
|-----------------------------------|--------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`        | Production, Preview     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Production, Preview     |

(Both envs existed in "Production, Preview" -- one `vercel env rm <name> production`
call removed them from both targets simultaneously; the follow-up `preview`
call returned `env_not_found`, as expected.)

## Verification

After removal:

```
$ vercel env ls | rg NEXT_PUBLIC_SUPABASE
(no output)
```

## Rollback (if ever needed)

If a future build references the legacy names again, restore via the
Vercel Marketplace -> Supabase integration "Sync env vars" button. The
canonical replacements are already deployed:

- `NEXT_PUBLIC_VERCEL_SUPABASE_URL`
- `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY`
- `VERCEL_SUPABASE_URL`
- `VERCEL_SUPABASE_SERVICE_ROLE_KEY`
