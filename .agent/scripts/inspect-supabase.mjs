/**
 * Inspect Vercel-managed Supabase state before applying migrations.
 * Writes findings to .agent/migration/vercel-supabase-state.md
 *
 * Usage: node .agent/scripts/inspect-supabase.mjs [--apply]
 *
 * Without --apply: read-only inspection.
 * With    --apply: applies 20260605000000_phase1_reconciliation.sql
 *                  iff the inspection confirms it's safe (initial schema present,
 *                  reconciliation not yet applied).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const { Client } = pg;

const rawConnectionString = process.env.VERCEL_POSTGRES_URL_NON_POOLING;
if (!rawConnectionString) {
  console.error("VERCEL_POSTGRES_URL_NON_POOLING missing from .env.local");
  process.exit(1);
}
// Strip sslmode from the URL so we can pass an explicit ssl object that
// disables CA verification (Supabase pooler presents an intermediate cert
// node treats as self-signed without the Supabase CA bundle).
const u = new URL(rawConnectionString);
u.searchParams.delete("sslmode");
u.searchParams.delete("supa");
const connectionString = u.toString();

const APPLY = process.argv.includes("--apply");
const FORCE_INITIAL = process.argv.includes("--force-initial");
const FORCE_RECON = process.argv.includes("--force-reconciliation");

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const tablesQ = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'
  order by table_name
`);
const tables = tablesQ.rows.map((r) => r.table_name);

const requiredTables = [
  "leads",
  "bookings",
  "projects",
  "project_files",
  "invoices",
  "profiles",
  "page_events"
];
const newTables = ["work_orders", "work_order_attachments"];

const missingBase = requiredTables.filter((t) => !tables.includes(t));
const hasMessages = tables.includes("messages");
const hasWorkOrders = tables.includes("work_orders");
const hasWorkOrderAtt = tables.includes("work_order_attachments");

const invColsQ = await client.query(`
  select column_name
  from information_schema.columns
  where table_schema='public' and table_name='invoices'
`);
const invCols = invColsQ.rows.map((r) => r.column_name);
const hasHostedUrl = invCols.includes("hosted_invoice_url");

let buckets = [];
try {
  const b = await client.query(`select id from storage.buckets order by id`);
  buckets = b.rows.map((r) => r.id);
} catch (e) {
  buckets = [`<unable to read storage.buckets: ${e.message}>`];
}
const hasWoBucket = buckets.includes("work-order-attachments");
const hasProjectFilesBucket = buckets.includes("project-files");

const enumsQ = await client.query(`
  select t.typname
  from pg_type t
  join pg_enum e on t.oid = e.enumtypid
  group by t.typname
  order by t.typname
`);
const enums = enumsQ.rows.map((r) => r.typname);

// Decide what to do.
const initialApplied = missingBase.length === 0;
const reconciliationApplied = !hasMessages && hasWorkOrders && hasWorkOrderAtt && hasHostedUrl;

const inspection = {
  generated_at: new Date().toISOString(),
  connection: { host: new URL(connectionString).host, database: "postgres" },
  tables,
  enums,
  invoices_columns: invCols,
  storage_buckets: buckets,
  checks: {
    initial_schema_present: initialApplied,
    missing_base_tables: missingBase,
    messages_table_present: hasMessages,
    work_orders_present: hasWorkOrders,
    work_order_attachments_present: hasWorkOrderAtt,
    invoices_hosted_invoice_url_present: hasHostedUrl,
    work_order_attachments_bucket_present: hasWoBucket,
    project_files_bucket_present: hasProjectFilesBucket,
    initial_schema_applied: initialApplied,
    reconciliation_migration_applied: reconciliationApplied
  }
};

mkdirSync(".agent/migration", { recursive: true });
const reportLines = [];
reportLines.push("# Vercel Supabase — Migration State Verification");
reportLines.push("");
reportLines.push(`**Generated:** ${inspection.generated_at}`);
reportLines.push(`**Host:** \`${inspection.connection.host}\``);
reportLines.push("");
reportLines.push("## Tables (public)");
reportLines.push("");
reportLines.push(tables.map((t) => `- \`${t}\``).join("\n") || "_none_");
reportLines.push("");
reportLines.push("## Enums");
reportLines.push("");
reportLines.push(enums.map((t) => `- \`${t}\``).join("\n") || "_none_");
reportLines.push("");
reportLines.push("## `public.invoices` columns");
reportLines.push("");
reportLines.push(invCols.map((c) => `- \`${c}\``).join("\n"));
reportLines.push("");
reportLines.push("## Storage buckets");
reportLines.push("");
reportLines.push(buckets.map((b) => `- \`${b}\``).join("\n") || "_none_");
reportLines.push("");
reportLines.push("## Verification checks");
reportLines.push("");
reportLines.push("| Check | Result |");
reportLines.push("|---|---|");
for (const [k, v] of Object.entries(inspection.checks)) {
  const pretty = Array.isArray(v) ? (v.length === 0 ? "_(none)_" : v.join(", ")) : v ? "✅" : "❌";
  reportLines.push(`| ${k} | ${pretty} |`);
}
reportLines.push("");
reportLines.push("## State summary");
reportLines.push("");
reportLines.push(
  `- Initial schema (\`20260521000000\`) applied: **${initialApplied ? "YES" : "NO"}**`
);
reportLines.push(
  `- Reconciliation (\`20260605000000\`) applied: **${reconciliationApplied ? "YES" : "NO"}**`
);

writeFileSync(".agent/migration/vercel-supabase-state.md", reportLines.join("\n") + "\n");

console.log("=== Inspection complete ===");
console.log(`Initial applied:        ${initialApplied}`);
console.log(`Reconciliation applied: ${reconciliationApplied}`);
console.log(`Report -> .agent/migration/vercel-supabase-state.md`);

if (!APPLY) {
  await client.end();
  process.exit(0);
}

// --- APPLY MODE ---
// Apply each migration if not yet applied (or if forced).
async function applyFile(path, label) {
  const sql = readFileSync(resolve(path), "utf8");
  console.log(`\n>>> Applying ${label} (${sql.length} chars)...`);
  try {
    await client.query(sql);
    console.log(`<<< ${label} applied.`);
    return { ok: true };
  } catch (e) {
    console.error(`!!! ${label} FAILED:`, e.message);
    return { ok: false, error: e.message };
  }
}

const results = [];
if (!initialApplied || FORCE_INITIAL) {
  results.push({
    file: "20260521000000_initial_schema.sql",
    ...(await applyFile("supabase/migrations/20260521000000_initial_schema.sql", "initial schema"))
  });
} else {
  console.log("Skipping initial schema (already present).");
}

if (!reconciliationApplied || FORCE_RECON) {
  results.push({
    file: "20260605000000_phase1_reconciliation.sql",
    ...(await applyFile(
      "supabase/migrations/20260605000000_phase1_reconciliation.sql",
      "phase-1 reconciliation"
    ))
  });
} else {
  console.log("Skipping reconciliation (already applied).");
}

console.log("\n=== Apply results ===");
console.log(JSON.stringify(results, null, 2));

await client.end();

const allOk = results.every((r) => r.ok);
process.exit(allOk ? 0 : 1);
