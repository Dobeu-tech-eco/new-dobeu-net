# Run legacy inventory now (operator)

**Target:** legacy Supabase project `db-dobeutech-unified`  
**Where:** Supabase Studio → SQL Editor (legacy project, not `ipmjokuezeuukhrilduq`)

Paste each query below, copy the raw output into the matching block in [`.agent/migration/inventory.md`](inventory.md) § [Findings](#findings-fill-in), then hand back to the agent.

---

## Query 1 — List every `public` table

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
```

Paste into **§1 — public tables**.

---

## Query 2 — Approximate row counts

```sql
select schemaname, relname as table_name, n_live_tup as approx_rows
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc;
```

Paste into **§2 — approximate row counts**.

---

## Query 3 — Lead-candidate tables + exact counts

```sql
select to_regclass('public.leads')               as leads,
       to_regclass('public.dobeu_net_leads')     as dobeu_net_leads,
       to_regclass('public.contact_submissions') as contact_submissions;
```

For each table name that returns a non-null regclass, run:

```sql
select count(*) from public.<table_name>;
```

Paste into **§3 — lead-candidate table existence + exact counts**.

---

## After these three

The full runbook (§4–§8: column schema, FKs, RLS, storage, optional `pg_dump`) is in [`inventory.md`](inventory.md). Run those when you have time; the agent can start `mapping.sql` once §1–§4 are filled.

**Do not commit connection strings or passwords.**
