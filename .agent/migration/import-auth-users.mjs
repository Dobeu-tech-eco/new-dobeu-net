#!/usr/bin/env node
/**
 * Optional: pre-seed target Supabase auth from legacy db-dobeutech-unified.
 *
 * Cutover decision A (default): skip this script — users magic-link on first visit.
 * Use only if operator wants the 3 legacy accounts created on target before go-live.
 *
 * REQUIREMENTS (operator provides — never commit):
 *   LEGACY_DATABASE_URL          — direct Postgres URI for db-dobeutech-unified
 *   TARGET_SUPABASE_URL          — Vercel Supabase project URL (ipmjokuezeuukhrilduq)
 *   TARGET_SUPABASE_SERVICE_ROLE — service role key for Admin API
 *
 * PASSWORDS: Supabase cannot copy password hashes across projects. This app uses
 * magic-link only; created users have email_confirm: true and no password —
 * they sign in via magic link on first visit.
 *
 * USAGE (dry-run first):
 *   node .agent/migration/import-auth-users.mjs --dry-run
 *   node .agent/migration/import-auth-users.mjs
 *
 * DO NOT run without credentials. DO NOT commit connection strings or output.
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function fetchLegacyUsers(legacyUrl) {
  const client = new pg.Client({ connectionString: legacyUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select id, email, created_at
       from auth.users
       order by created_at`
    );
    return rows;
  } finally {
    await client.end();
  }
}

async function createTargetUser(admin, { id, email, created_at }) {
  const payload = {
    email,
    email_confirm: true,
    user_metadata: { legacy_imported_at: new Date().toISOString() },
  };
  // Preserve UUID when supported (GoTrue import path); Admin createUser may assign new id.
  if (id) payload.id = id;

  const { data, error } = await admin.auth.admin.createUser(payload);
  if (error) throw new Error(`${email}: ${error.message}`);
  console.log(`  created ${email} → ${data.user?.id ?? "(unknown id)"} (legacy ${id}, created ${created_at})`);
  return data.user;
}

async function main() {
  if (DRY_RUN) console.log("DRY RUN — no target writes\n");

  const legacyUrl = requireEnv("LEGACY_DATABASE_URL");
  const targetUrl = requireEnv("TARGET_SUPABASE_URL");
  const serviceRole = requireEnv("TARGET_SUPABASE_SERVICE_ROLE");

  const users = await fetchLegacyUsers(legacyUrl);
  console.log(`Legacy auth.users: ${users.length} row(s)\n`);

  if (users.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  for (const u of users) {
    console.log(`  ${u.id}  ${u.email}  ${u.created_at}`);
  }

  if (DRY_RUN) {
    console.log("\nDry run complete. Re-run without --dry-run to create on target.");
    return;
  }

  const admin = createClient(targetUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("\nCreating on target...");
  for (const u of users) {
    await createTargetUser(admin, u);
  }

  console.log("\nDone. Users must magic-link to sign in (no passwords migrated).");
  console.log("profiles rows auto-create via handle_new_user on first auth.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
