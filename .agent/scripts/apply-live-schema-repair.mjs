/**
 * Apply live schema repair migration to Vercel Supabase.
 *
 * Usage: node .agent/scripts/apply-live-schema-repair.mjs [--apply]
 *
 * Without --apply: read-only inspection of drift targets.
 * With    --apply: applies 20260617000000_live_schema_repair.sql.
 *
 * Requires VERCEL_POSTGRES_URL_NON_POOLING in .env.local (non-pooling Postgres URL).
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const { Client } = pg;

const raw = process.env.VERCEL_POSTGRES_URL_NON_POOLING;
if (!raw) {
  console.error("VERCEL_POSTGRES_URL_NON_POOLING missing from .env.local");
  process.exit(1);
}
const u = new URL(raw);
u.searchParams.delete("sslmode");
u.searchParams.delete("supa");
const connectionString = u.toString();

const APPLY = process.argv.includes("--apply");

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

async function inspect() {
  const colsQ = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
    order by ordinal_position
  `);
  const cols = colsQ.rows.map((r) => r.column_name);

  const projectsQ = await client.query(`
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'projects'
  `);
  const hasProjects = projectsQ.rowCount > 0;

  const fkQ = await client.query(`
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
      and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and tc.table_name = 'project_files'
      and kcu.column_name = 'project_id'
      and ccu.table_name = 'projects'
  `);
  const hasProjectFilesFk = fkQ.rowCount > 0;

  return {
    cols,
    hasUpdatedAt: cols.includes("updated_at"),
    hasStripeCustomerId: cols.includes("stripe_customer_id"),
    hasProjects,
    hasProjectFilesFk,
  };
}

const before = await inspect();

console.log("=== live schema repair inspection ===");
console.log("profiles columns:", before.cols.join(", "));
console.log(`profiles.updated_at present:        ${before.hasUpdatedAt ? "YES" : "NO"}`);
console.log(`profiles.stripe_customer_id present: ${before.hasStripeCustomerId ? "YES" : "NO"}`);
console.log(`public.projects table present:       ${before.hasProjects ? "YES" : "NO"}`);
console.log(`project_files -> projects FK present: ${before.hasProjectFilesFk ? "YES" : "NO"}`);

const needsRepair =
  !before.hasUpdatedAt ||
  !before.hasStripeCustomerId ||
  !before.hasProjects;

if (!APPLY) {
  console.log(`\nRepair needed: ${needsRepair ? "YES" : "NO"}`);
  await client.end();
  process.exit(0);
}

const migrationPath = "supabase/migrations/20260617000000_live_schema_repair.sql";
if (!existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  await client.end();
  process.exit(1);
}

if (!needsRepair) {
  console.log("\nAlready applied — nothing to do.");
  await client.end();
  process.exit(0);
}

const sql = readFileSync(resolve(migrationPath), "utf8");
console.log(`\n>>> Applying live schema repair (${sql.length} chars)...`);
try {
  await client.query(sql);
  console.log("<<< Applied.");
} catch (e) {
  console.error("!!! FAILED:", e.message);
  await client.end();
  process.exit(1);
}

const after = await inspect();
const ok =
  after.hasUpdatedAt &&
  after.hasStripeCustomerId &&
  after.hasProjects;

console.log("\nVerification:");
console.log(`  profiles.updated_at:         ${after.hasUpdatedAt ? "YES" : "NO"}`);
console.log(`  profiles.stripe_customer_id: ${after.hasStripeCustomerId ? "YES" : "NO"}`);
console.log(`  public.projects:             ${after.hasProjects ? "YES" : "NO"}`);
console.log(`  project_files FK:            ${after.hasProjectFilesFk ? "YES" : "NO (skipped or pre-existing)"}`);

if (ok) {
  const stateFile = ".agent/migration/vercel-supabase-state.md";
  if (existsSync(stateFile)) {
    appendFileSync(
      stateFile,
      "\n\n## Live schema repair (2026-06-17)\n\n" +
        `- \`profiles.updated_at\`: **YES**\n` +
        `- \`profiles.stripe_customer_id\`: **YES**\n` +
        `- \`public.projects\` table: **YES**\n` +
        `- Applied at: ${new Date().toISOString()}\n`
    );
    console.log(`\nAppended repair state to ${stateFile}`);
  }
}

await client.end();
process.exit(ok ? 0 : 1);
