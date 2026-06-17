/**
 * Operator-only: set (or create) a Supabase user's password WITHOUT an email
 * round-trip. This is the cutover fallback when magic-link / SMTP delivery is
 * broken — the operator sets a password here, then the user signs in via the
 * "Sign in with a password instead" option on /login.
 *
 * Uses the service-role key (admin API), so it must only ever run locally /
 * server-side. NEVER commit credentials. Password is read from an env var or
 * an interactive prompt — never from a CLI arg (avoids shell history leakage).
 *
 * Usage:
 *   # 1) Pull envs (service role key + supabase url) into .env.local first:
 *   #    vercel env pull .env.local
 *   # 2) Provide the password via env (preferred) or interactive prompt:
 *   NEW_USER_PASSWORD='S3cret!' node scripts/set-user-password.mjs user@dobeu.net
 *   # or, prompt interactively (no password in env/history):
 *   node scripts/set-user-password.mjs user@dobeu.net
 *
 * Flags:
 *   --create   Create the user if they don't already exist (default: error out).
 */
import { createInterface } from "node:readline";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const email = process.argv.find((a) => a.includes("@"));
const allowCreate = process.argv.includes("--create");

if (!email) {
  console.error("Usage: node scripts/set-user-password.mjs <email> [--create]");
  process.exit(1);
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL || process.env.VERCEL_SUPABASE_URL;
const serviceRoleKey = process.env.VERCEL_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing VERCEL_SUPABASE_URL / VERCEL_SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run `vercel env pull .env.local` first (or export them in this shell).",
  );
  process.exit(1);
}

async function readPassword() {
  if (process.env.NEW_USER_PASSWORD) return process.env.NEW_USER_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) =>
    rl.question(`New password for ${email}: `, res),
  );
  rl.close();
  return answer;
}

const password = (await readPassword())?.trim();
if (!password || password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Find the user by paging through the admin list (no get-by-email endpoint).
async function findUserByEmail(target) {
  const wanted = target.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

const existing = await findUserByEmail(email);

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("Failed to set password:", error.message);
    process.exit(1);
  }
  console.log(`✅ Password updated for ${email} (id: ${existing.id}).`);
} else if (allowCreate) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("Failed to create user:", error.message);
    process.exit(1);
  }
  console.log(`✅ Created ${email} with a password (id: ${data.user.id}).`);
} else {
  console.error(
    `No user found for ${email}. Re-run with --create to make a new one.`,
  );
  process.exit(1);
}

console.log('Now sign in at https://dobeu.net/login → "Sign in with a password instead".');
process.exit(0);
