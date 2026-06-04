/**
 * Apply Phase 3 mini-migration (profiles.stripe_customer_id) to Vercel Supabase.
 *
 * Usage: node .agent/scripts/apply-phase3-migration.mjs [--apply]
 *
 * Without --apply: read-only inspection of profiles columns + indexes.
 * With    --apply: applies 20260615000000_phase3_stripe_customer_id.sql.
 *
 * Re-verifies state in .agent/migration/vercel-supabase-state.md.
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

const colsQ = await client.query(`
  select column_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
  order by ordinal_position
`);
const cols = colsQ.rows.map((r) => r.column_name);
const hasCol = cols.includes("stripe_customer_id");

const idxQ = await client.query(`
  select indexname
  from pg_indexes
  where schemaname = 'public' and tablename = 'profiles'
  order by indexname
`);
const indexes = idxQ.rows.map((r) => r.indexname);
const hasIdx = indexes.includes("profiles_stripe_customer_id_unique");

console.log("=== profiles inspection ===");
console.log("columns:", cols.join(", "));
console.log("indexes:", indexes.join(", "));
console.log(`stripe_customer_id column present: ${hasCol ? "YES" : "NO"}`);
console.log(`partial unique index present:      ${hasIdx ? "YES" : "NO"}`);

if (!APPLY) {
  await client.end();
  process.exit(0);
}

const migrationPath = "supabase/migrations/20260615000000_phase3_stripe_customer_id.sql";
if (!existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  await client.end();
  process.exit(1);
}

if (hasCol && hasIdx) {
  console.log("Already applied — nothing to do.");
  await client.end();
  process.exit(0);
}

const sql = readFileSync(resolve(migrationPath), "utf8");
console.log(`\n>>> Applying Phase 3 stripe_customer_id migration (${sql.length} chars)...`);
try {
  await client.query(sql);
  console.log("<<< Applied.");
} catch (e) {
  console.error("!!! FAILED:", e.message);
  await client.end();
  process.exit(1);
}

// Re-verify
const verifyCols = await client.query(`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='profiles' and column_name='stripe_customer_id'
`);
const verifyIdx = await client.query(`
  select indexname from pg_indexes
  where schemaname='public' and tablename='profiles'
    and indexname='profiles_stripe_customer_id_unique'
`);

const okCol = verifyCols.rowCount === 1;
const okIdx = verifyIdx.rowCount === 1;
console.log(`\nVerification:`);
console.log(`  stripe_customer_id column: ${okCol ? "✅" : "❌"}`);
console.log(`  partial unique index:      ${okIdx ? "✅" : "❌"}`);

if (okCol && okIdx) {
  const stateFile = ".agent/migration/vercel-supabase-state.md";
  if (existsSync(stateFile)) {
    appendFileSync(
      stateFile,
      "\n\n## Phase 3 mini-migration (2026-06-15)\n\n" +
        `- \`profiles.stripe_customer_id\` column: ✅\n` +
        `- \`profiles_stripe_customer_id_unique\` partial unique index: ✅\n` +
        `- Applied at: ${new Date().toISOString()}\n`
    );
    console.log(`\nAppended Phase 3 state to ${stateFile}`);
  }
}

await client.end();
process.exit(okCol && okIdx ? 0 : 1);
