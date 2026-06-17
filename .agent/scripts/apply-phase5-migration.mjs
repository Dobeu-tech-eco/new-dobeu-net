/**
 * Apply Phase 5 migration (drop profiles.is_admin) to Vercel Supabase.
 *
 * Usage: node .agent/scripts/apply-phase5-migration.mjs [--apply]
 *
 * Without --apply: read-only inspection of profiles.is_admin column.
 * With    --apply: applies 20260616000000_phase5_drop_is_admin.sql.
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

const colsQ = await client.query(`
  select column_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
  order by ordinal_position
`);
const cols = colsQ.rows.map((r) => r.column_name);
const hasIsAdmin = cols.includes("is_admin");

console.log("=== profiles inspection (Phase 5) ===");
console.log("columns:", cols.join(", "));
console.log(`is_admin column present: ${hasIsAdmin ? "YES" : "NO"}`);

if (!APPLY) {
  await client.end();
  process.exit(0);
}

const migrationPath = "supabase/migrations/20260616000000_phase5_drop_is_admin.sql";
if (!existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  await client.end();
  process.exit(1);
}

if (!hasIsAdmin) {
  console.log("Already applied - is_admin column absent.");
  await client.end();
  process.exit(0);
}

const sql = readFileSync(resolve(migrationPath), "utf8");
console.log(`\n>>> Applying Phase 5 drop is_admin migration (${sql.length} chars)...`);
try {
  await client.query(sql);
  console.log("<<< Applied.");
} catch (e) {
  console.error("!!! FAILED:", e.message);
  await client.end();
  process.exit(1);
}

const verifyQ = await client.query(`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='profiles' and column_name='is_admin'
`);
const ok = verifyQ.rowCount === 0;
console.log(`\nVerification: is_admin absent: ${ok ? "YES" : "NO"}`);

if (ok) {
  const stateFile = ".agent/migration/vercel-supabase-state.md";
  if (existsSync(stateFile)) {
    appendFileSync(
      stateFile,
      "\n\n## Phase 5 migration (2026-06-16)\n\n" +
        `- \`profiles.is_admin\` column dropped: **YES**\n` +
        `- Applied at: ${new Date().toISOString()}\n`
    );
    console.log(`\nAppended Phase 5 state to ${stateFile}`);
  }
}

await client.end();
process.exit(ok ? 0 : 1);
