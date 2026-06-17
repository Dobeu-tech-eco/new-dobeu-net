# Legacy DB cutover — operator execute runbook

**Source:** `db-dobeutech-unified` (legacy)  
**Target:** Vercel Marketplace Supabase `ipmjokuezeuukhrilduq`  
**Plan refs:** `.agent/PRODUCTION-PLAN.md` §6, `docs/superpowers/plans/2026-06-05-remaining-phases.md` Task Group C

> **Prerequisite:** [`.agent/migration/inventory.md`](inventory.md) Findings complete (§1–§8). Partial inventory as of 2026-06-16 — run [`.agent/migration/inventory-followup.sql`](inventory-followup.sql) first. Agent-authored `mapping.sql` exists (draft); `restore-staging.sql` TBD after schema follow-up.

## Strategy revision (2026-06-16 — partial inventory)

Legacy `db-dobeutech-unified` is a **unified platform schema** (30 `public` tables),
not the dobeu.net v3 `initial_schema.sql` shape. Bulk of row volume is
`composio_tools` (3072 rows) and other platform internals — **not** portal data.

**Confirmed so far:**

| Finding | Implication |
|---------|-------------|
| `contact_submissions` exists, **0 rows** | No lead migration work |
| `leads` / `dobeu_net_leads` **absent** | No dedupe needed |
| Top tables are platform tooling | Full `pg_dump` restore would pollute target |

**Recommended approach:** **selective SQL migration** via `.agent/migration/mapping.sql`
only for portal-relevant tables (`client_files`, and any of `users` / `projects` /
`invoices` confirmed by follow-up). Skip excluded platform tables (see `mapping.sql`
header). If follow-up shows `auth.users` count = 0 and no portal rows, cutover
may reduce to **schema-only target** (already applied) + optional `client_files`
row/storage copy — no full dump/restore cycle.

---

## Phase 0 — Pre-flight (T-1 day)

| # | Action | Owner |
|---|--------|-------|
| 0.1 | Confirm live Vercel `*_SUPABASE_*` envs point at `ipmjokuezeuukhrilduq` (likely already true) | Operator |
| 0.2 | Verify target schema current: Phase 5 applied (`profiles.is_admin` absent) | Operator / agent script |
| 0.3 | Review filled Findings + agent `mapping.sql` for surprises | Operator + agent |
| 0.4 | Communicate to clients: passwords do not migrate; magic-link re-auth after cutover | Operator |
| 0.5 | Stripe webhook + Resend DKIM verified (see `.agent/ops/stripe-webhook-status.md`) | Operator |
| 0.6 | Supabase Auth → **SMTP Settings** (Resend) + **Rate Limits** raised for magic-link testing (`docs/DEPLOYMENT.md` §Phase 2 steps 5–6, project `ipmjokuezeuukhrilduq`) | Operator |

---

## Phase 1 — Freeze writes (cutover window start)

1. **Calendly webhook** — disable or pause the `invitee.created` webhook in Calendly dashboard (or remove signing key temporarily so `/api/webhooks/calendly` returns 503).
2. **`/api/lead`** — put in maintenance (Vercel env flag or temporary route guard) so no new leads land on legacy during dump.
3. **Portal/admin mutations** — optional banner; not strictly required if legacy is read-only and target is empty today.
4. Note freeze timestamp in this file.

---

## Phase 2 — Extract legacy data (selective, not full dump)

**Prefer per-table export** for portal-relevant tables only. Full `pg_dump -n public`
imports `composio_tools` and other platform tables — avoid unless operator overrides.

```bash
# Option A — single table (repeat per confirmed migratable table)
psql "$LEGACY_DATABASE_URL" -c "\copy public.client_files TO 'client_files.csv' CSV HEADER"

# Option B — structure-only for diffing (safe, no row pollution)
pg_dump "$LEGACY_DATABASE_URL" \
  --schema-only --no-owner --no-privileges \
  -n public \
  > .agent/migration/legacy-schema.sql
```

If multiple portal tables have rows, a **table-filtered** dump is acceptable:

```bash
# Example: only tables listed in mapping.sql MIGRATE section (adjust after follow-up)
pg_dump "$LEGACY_DATABASE_URL" \
  --no-owner --no-privileges \
  -t public.client_files \
  -t public.projects \
  -t public.users \
  -Fc > .agent/migration/legacy-portal-data.dump
```

---

## Phase 3 — Load into staging schema on target

1. Connect to target Postgres (`VERCEL_POSTGRES_URL_NON_POOLING` or Supabase Studio).
2. Create `legacy_import` schema + staging tables matching **migratable** legacy shapes only (agent `restore-staging.sql` or manual `\copy` into temp tables).
3. Load CSV/dump into `legacy_import` — **do not** restore full 30-table dump into `public`.

---

## Phase 4 — Transform + auth import

1. Run **`.agent/migration/mapping.sql`** on target (`insert into public.X select … from legacy_import.Y`).
   - **Leads:** skip — `contact_submissions` empty; no legacy `leads` table.
   - `profiles` insert: **omit `is_admin`** (column dropped on target).
   - `messages`: excluded (Intercom owns chat).
   - Platform tables in EXCLUDED list: never insert.
2. **Auth users** — only if `auth.users` count > 0 on legacy (check inventory-followup.sql §8). Scripted loop via Supabase Admin API (`auth.admin.createUser`) keyed off legacy `users` rows. `handle_new_user()` creates `profiles` rows; reconcile FKs after.
3. **Storage** — copy objects for migrated `client_files` / `project_files` rows only; verify `project_files.storage_path` resolves in target `project-files` bucket.

---

## Phase 5 — Verify (pre-unfreeze gates)

Run parity checks from PRODUCTION-PLAN §6.5:

| Check | Command / query |
|-------|-----------------|
| Row counts | Compare legacy vs target per table (Findings §2 baseline) |
| FK integrity | `select …` orphan checks on `projects`, `invoices`, `project_files` |
| Auth | Spot-login 2–3 migrated users via magic link |
| Storage | Download one file per bucket from portal |
| App smoke | `scripts/post-merge-smoke.md` §A curl + §B manual ticket journey |

---

## Phase 6 — Env swap (if needed)

If Vercel envs already point at target: **no-op**. Otherwise update:

- `NEXT_PUBLIC_VERCEL_SUPABASE_URL`
- `NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY`
- `VERCEL_SUPABASE_URL`
- `VERCEL_SUPABASE_SERVICE_ROLE_KEY`

Redeploy production.

---

## Phase 7 — Unfreeze + soak

1. Re-enable Calendly webhook + `/api/lead`.
2. **24h watch** — monitor Stripe webhooks, lead pipeline, ticket flows.
3. **7-day soak** — keep legacy `db-dobeutech-unified` **read-only** (do not delete).
4. After soak: archive legacy project, update `STATUS.md` + convergence doc.

---

## Rollback (if mapping fails before unfreeze)

- Target still has pre-cutover state if you snapshot before Phase 4.
- Do not unfreeze writes until parity gates pass.
- Legacy remains authoritative until soak completes.

---

## Artifacts checklist

- [x] `inventory.md` Findings §1–§3 (partial, 2026-06-16)
- [ ] `inventory.md` Findings §4–§8 (run `inventory-followup.sql`)
- [ ] `restore-staging.sql` (agent — after schema follow-up)
- [x] `mapping.sql` (agent draft — do not run until schema confirmed)
- [ ] `legacy-portal-data.dump` or per-table CSVs (operator, gitignored)
- [ ] Auth import script (agent — only if legacy `auth.users` > 0)
- [ ] Storage copy log (operator — only if `client_files` rows > 0)
