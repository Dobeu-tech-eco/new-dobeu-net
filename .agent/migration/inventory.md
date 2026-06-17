# Legacy DB inventory — `db-dobeutech-unified` → Vercel-managed Supabase

**Status:** Pre-cutover. Run the queries below against the legacy
`db-dobeutech-unified` Supabase project, paste the output into the
[Findings](#findings-fill-in) section, and hand back to the parent agent so
it can author the mapping SQL against the existing Phase 1 reconciliation
migration (`supabase/migrations/20260605000000_phase1_reconciliation.sql`).

Do **not** run anything in this runbook against the Vercel-managed target —
this is read-only discovery on the legacy DB.

Why this exists (one paragraph): the production plan (§6) assumes a one-shot
dump-and-restore cutover with the legacy DB held read-only for a 7-day soak.
That plan cannot land its mapping SQL until we see the legacy schema's exact
column shapes and row counts. This runbook is the first half of §6.1.

---

## 0. Prerequisites

You'll need:

- The legacy project ref + the **direct connection string** for
  `db-dobeutech-unified` from the Supabase dashboard
  (Project Settings → Database → Connection string → URI). Use the **direct**
  string (not the pooler), or the pooler with `?pgbouncer=true&connection_limit=1`
  if direct is firewalled.
- Either `psql` locally on PATH, or the **Supabase Studio SQL Editor**
  pointed at the legacy project (no install required — easier on Windows).
- Output destination: paste each query's output verbatim into the
  [Findings](#findings-fill-in) section below.

Export the legacy URL in your shell once so the `psql` snippets work as-is:

```powershell
# PowerShell (Windows)
$env:LEGACY_DATABASE_URL = "postgresql://postgres.<ref>:<password>@<host>:5432/postgres"
```

```bash
# Bash / WSL / Git Bash
export LEGACY_DATABASE_URL="postgresql://postgres.<ref>:<password>@<host>:5432/postgres"
```

> **Do not commit the URL anywhere** — copy from the dashboard each session.

---

## 1. List every `public` user table

### psql

```powershell
psql "$env:LEGACY_DATABASE_URL" -c "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name;"
```

### Supabase Studio SQL Editor

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
```

---

## 2. Approximate row counts per table

These come from the planner stats — fast and usually within ~1% of reality.
Use the exact count in §3 below for any table that looks close to a transform
threshold (e.g. dedupe of leads).

### psql

```powershell
psql "$env:LEGACY_DATABASE_URL" -c "select schemaname, relname as table_name, n_live_tup as approx_rows from pg_stat_user_tables where schemaname = 'public' order by n_live_tup desc;"
```

### Supabase Studio SQL Editor

```sql
select schemaname, relname as table_name, n_live_tup as approx_rows
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc;
```

---

## 3. Exact row counts (for the lead-candidate tables + anything close to a dedupe threshold)

The three known lead-candidate names from `lib/leads.ts` (pre-cleanup) were
`leads`, `dobeu_net_leads`, `contact_submissions`. Confirm which exist on
the legacy DB and capture exact counts.

### psql

```powershell
psql "$env:LEGACY_DATABASE_URL" -c "select to_regclass('public.leads') as leads, to_regclass('public.dobeu_net_leads') as dobeu_net_leads, to_regclass('public.contact_submissions') as contact_submissions;"

# For each that resolves to a non-null regclass, run an exact count:
psql "$env:LEGACY_DATABASE_URL" -c "select count(*) from public.leads;"
psql "$env:LEGACY_DATABASE_URL" -c "select count(*) from public.dobeu_net_leads;"
psql "$env:LEGACY_DATABASE_URL" -c "select count(*) from public.contact_submissions;"
```

### Supabase Studio SQL Editor

```sql
select to_regclass('public.leads')               as leads,
       to_regclass('public.dobeu_net_leads')     as dobeu_net_leads,
       to_regclass('public.contact_submissions') as contact_submissions;

-- Then per table that exists:
select count(*) from public.leads;
select count(*) from public.dobeu_net_leads;
select count(*) from public.contact_submissions;
```

---

## 4. Full column schema per public table

This is the workhorse — captures column name, type, nullability, default, and
ordinal position. The mapping SQL in §6.2 of the production plan is built
directly from this.

### psql

```powershell
psql "$env:LEGACY_DATABASE_URL" -c "select table_name, column_name, data_type, is_nullable, column_default, ordinal_position from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position;"
```

### Supabase Studio SQL Editor

```sql
select table_name, column_name, data_type, is_nullable, column_default, ordinal_position
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

---

## 5. Foreign keys + referenced tables

So we can resolve FK fan-out (legacy `projects.owner_user_id` → legacy
`users` → migrated `auth.users.id`, etc.).

### psql

```powershell
psql "$env:LEGACY_DATABASE_URL" -c "select tc.table_name, kcu.column_name, ccu.table_name as references_table, ccu.column_name as references_column, tc.constraint_name from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public' order by tc.table_name, kcu.column_name;"
```

### Supabase Studio SQL Editor

```sql
select tc.table_name,
       kcu.column_name,
       ccu.table_name  as references_table,
       ccu.column_name as references_column,
       tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema   = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema    = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;
```

---

## 6. RLS policies on every public table

So we don't accidentally restore a more-permissive policy on the target.

### psql

```powershell
psql "$env:LEGACY_DATABASE_URL" -c "select schemaname, tablename, policyname, permissive, roles::text, cmd, qual, with_check from pg_policies where schemaname = 'public' order by tablename, policyname;"
```

### Supabase Studio SQL Editor

```sql
select schemaname, tablename, policyname, permissive, roles::text, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

---

## 7. Storage buckets + object counts

So we can plan the file copy in production-plan §6.3 step 4.

### Supabase Studio SQL Editor

```sql
select id, name, public, created_at from storage.buckets order by name;

-- Object counts per bucket
select bucket_id, count(*) as object_count
from storage.objects
group by bucket_id
order by object_count desc;
```

---

## 8. Dump structure-only for offline diffing (optional but recommended)

Produces a clean `legacy-schema.sql` that diffs cleanly against
`supabase/migrations/20260521000000_initial_schema.sql` +
`supabase/migrations/20260605000000_phase1_reconciliation.sql`.

```bash
# Requires pg_dump on PATH. On Windows: install via PostgreSQL bundle or use
# Docker: `docker run --rm postgres:16 pg_dump ...`
pg_dump "$LEGACY_DATABASE_URL" \
  --schema-only --no-owner --no-privileges \
  -n public \
  > .agent/migration/legacy-schema.sql
```

Save that file alongside this one. Don't commit it — it may leak schema
secrets or implementation details that aren't relevant to the public repo.
(It is already covered by `.agent/` being treated as scratch.)

---

## Findings (fill in)

**Inventory status (2026-06-16):** partial — §1–§3 verified via Supabase SQL
Editor screenshots on `db-dobeutech-unified`. §4–§8 still pending; run
[`.agent/migration/inventory-followup.sql`](inventory-followup.sql) and paste
results below.

### §1 — public tables

**30 rows total** (`information_schema.tables`, `public` + `BASE TABLE`).
Screenshot showed first 6 only; **24 table names not captured** (operator did
not scroll).

```text
agent_principles
analytics_daily
audit_logs
ccpa_requests
client_files
cloud_accounts
(... 24 more — unknown from screenshots; run inventory-followup.sql §1)
```

### §2 — approximate row counts

Planner stats (`pg_stat_user_tables`, `schemaname = 'public'`, ordered by
`n_live_tup desc`). **30 rows total**; screenshot showed top 6 only.

```text
 table_name          | approx_rows
---------------------+-------------
 composio_tools      |        3072
 analytics_daily     |          50
 dobeu_ecosystem     |          17
 cloud_accounts      |          12
 cowork_task_state   |           4
 service_credentials |           2
 (... remaining 24 tables — counts unknown from screenshots)
```

**Interpretation:** bulk of row volume is `composio_tools` (unified-platform
internals). No lead-candidate table appears in the top-6 by row count.

### §3 — lead-candidate table existence + exact counts

```sql
select to_regclass('public.leads')               as leads,
       to_regclass('public.dobeu_net_leads')     as dobeu_net_leads,
       to_regclass('public.contact_submissions') as contact_submissions;
```

```text
 leads | dobeu_net_leads | contact_submissions
-------+-----------------+---------------------
 NULL  | NULL            | contact_submissions
```

(`NULL` regclass = table does not exist. User note: "1 tablet with null" =
the two NULL results for `leads` / `dobeu_net_leads`.)

```sql
select count(*) from public.contact_submissions;
```

```text
 count
-------
     0
```

**Confirmed:** no `public.leads` or `public.dobeu_net_leads` on legacy;
`contact_submissions` exists but is **empty**.

### §4 — full column schema

```text
<paste output>
```

### §5 — foreign keys

```text
<paste output>
```

### §6 — RLS policies

```text
<paste output>
```

### §7 — storage buckets + object counts

```text
<paste output>
```

### §8 — `legacy-schema.sql` produced? (Y/N)

```text
<Y or N + path if produced>
```

### Notes / surprises (anything that doesn't match the production plan's assumed legacy shape)

```text
- Legacy is a unified Dobeu platform schema (30 public tables), NOT the
  dobeu.net v3 initial_schema.sql shape assumed in early 2026-05 docs.
- Top row volume is composio_tools (3072 rows) — platform tooling, not portal data.
- Lead pipeline source tables: only contact_submissions exists; 0 rows. No legacy
  leads or dobeu_net_leads tables.
- CHAT-TRANSCRIPT-2026-05-21 listed projects, messages, services, purchases,
  client_files, contact_submissions, audit_logs, rate_limits, newsletter_* —
  some may be among the 24 unscrolled table names; follow-up SQL required.
- Cutover should be SELECTIVE (portal-relevant tables only), not full pg_dump —
  see cutover-execute.md and mapping.sql draft.
```

---

## Next step

Once the [Findings](#findings-fill-in) section is filled in, the parent
agent will:

1. Author the staging-schema restore SQL (legacy dump → `legacy_import.*`
   on the target) per production-plan §6.3 step 3.
2. Author the per-table mapping SQL (`insert into public.X select ... from
   legacy_import.Y` with the transforms from §6.2 of the production plan,
   plus dedupe-by-email on leads).
3. Walk the auth-user import via Supabase Admin API
   (`auth.admin.createUser`) separately — `auth.users` cannot be bulk-inserted
   directly.
4. Sequence the storage object copy (legacy `project-files` →
   target `project-files`).
