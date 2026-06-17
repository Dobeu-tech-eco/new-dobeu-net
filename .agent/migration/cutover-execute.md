# Legacy DB cutover — operator execute runbook

**Source:** `db-dobeutech-unified` (legacy)  
**Target:** Vercel Marketplace Supabase `ipmjokuezeuukhrilduq`  
**Plan refs:** `.agent/PRODUCTION-PLAN.md` §6, `docs/superpowers/plans/2026-06-05-remaining-phases.md` Task Group C

> **Prerequisite:** [`.agent/migration/inventory.md`](inventory.md) Findings filled (§1–§8). Agent-authored `restore-staging.sql` + `mapping.sql` must exist before execution — do not run cutover from memory.

---

## Phase 0 — Pre-flight (T-1 day)

| # | Action | Owner |
|---|--------|-------|
| 0.1 | Confirm live Vercel `*_SUPABASE_*` envs point at `ipmjokuezeuukhrilduq` (likely already true) | Operator |
| 0.2 | Verify target schema current: Phase 5 applied (`profiles.is_admin` absent) | Operator / agent script |
| 0.3 | Review filled Findings + agent `mapping.sql` for surprises | Operator + agent |
| 0.4 | Communicate to clients: passwords do not migrate; magic-link re-auth after cutover | Operator |
| 0.5 | Stripe webhook + Resend DKIM verified (see `.agent/ops/stripe-webhook-status.md`) | Operator |

---

## Phase 1 — Freeze writes (cutover window start)

1. **Calendly webhook** — disable or pause the `invitee.created` webhook in Calendly dashboard (or remove signing key temporarily so `/api/webhooks/calendly` returns 503).
2. **`/api/lead`** — put in maintenance (Vercel env flag or temporary route guard) so no new leads land on legacy during dump.
3. **Portal/admin mutations** — optional banner; not strictly required if legacy is read-only and target is empty today.
4. Note freeze timestamp in this file.

---

## Phase 2 — Dump legacy

```bash
# Requires pg_dump + LEGACY_DATABASE_URL (direct connection, not committed)
pg_dump "$LEGACY_DATABASE_URL" \
  --no-owner --no-privileges \
  -n public \
  -Fc \
  > .agent/migration/legacy-data.dump
```

Optional structure-only for diff:

```bash
pg_dump "$LEGACY_DATABASE_URL" \
  --schema-only --no-owner --no-privileges \
  -n public \
  > .agent/migration/legacy-schema.sql
```

---

## Phase 3 — Restore into staging schema on target

1. Connect to target Postgres (`VERCEL_POSTGRES_URL_NON_POOLING` or Supabase Studio).
2. Run agent-authored **`.agent/migration/restore-staging.sql`** (creates `legacy_import` schema + tables matching legacy shapes).
3. Restore dump into `legacy_import`:

```bash
pg_restore -d "$TARGET_DATABASE_URL" \
  --schema=legacy_import \
  --no-owner --no-privileges \
  .agent/migration/legacy-data.dump
```

Adjust if dump format differs; `psql` COPY from CSV is an alternative per table.

---

## Phase 4 — Transform + auth import

1. Run **`.agent/migration/mapping.sql`** on target (`insert into public.X select … from legacy_import.Y`).
   - Leads: dedupe by email, keep most recent `last_seen`.
   - `profiles` insert: **omit `is_admin`** (column dropped on target).
   - `messages`: excluded (Intercom owns chat).
2. **Auth users** — scripted loop via Supabase Admin API (`auth.admin.createUser`) keyed off legacy `users` rows. `handle_new_user()` creates `profiles` rows; reconcile FKs after.
3. **Storage** — copy objects legacy `project-files` → target `project-files` bucket; verify `project_files.storage_path` resolves.

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

- [ ] `inventory.md` Findings complete
- [ ] `restore-staging.sql` (agent)
- [ ] `mapping.sql` (agent)
- [ ] `legacy-data.dump` (operator, gitignored)
- [ ] Auth import script (agent)
- [ ] Storage copy log (operator)
