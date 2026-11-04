/**
 * Operator-only: invite a test customer (and optionally put them in a
 * "Test Customer" company) so admin-posted work can be checked end to end.
 *
 * Invite-based: the customer signs in through the emailed link. This script
 * never sets a password and never marks an email confirmed.
 *
 * Dry run by default; nothing is written without --apply. Idempotent: an
 * existing user is not re-invited, the company is found by exact name before it
 * is created, and the membership is upserted.
 *
 * Refuses any address in ADMIN_EMAILS (read from the LOCAL env only; this
 * cannot see Vercel's value). With --apply it also refuses when ADMIN_EMAILS is
 * unset, so a missing allowlist fails closed.
 *
 * Usage:
 *   node scripts/invite-test-customer.mjs <email> [--with-company] [--apply]
 *
 * Needs VERCEL_SUPABASE_URL (or NEXT_PUBLIC_VERCEL_SUPABASE_URL) and
 * VERCEL_SUPABASE_SERVICE_ROLE_KEY in the environment or .env.local. Prints only
 * the target host, the planned steps and resulting ids; never keys or links.
 */
import { pathToFileURL } from "node:url";

export const COMPANY_NAME = "Test Customer";
export const AUDIT_ACTION = "script.invite_test_customer";

function parseAllowlist(raw) {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Same semantics as `isAdminEmail` in lib/utils.ts, over an explicit list.
/**
 * @param {string | null | undefined} email
 * @param {string | null | undefined} rawAdminEmails
 */
export function isAllowlisted(email, rawAdminEmails) {
  if (!email) return false;
  return parseAllowlist(rawAdminEmails).includes(email.toLowerCase());
}

/**
 * @typedef {object} PlanInput
 * @property {string | null | undefined} [email]
 * @property {boolean} [apply]
 * @property {boolean} [withCompany]
 * @property {string | null | undefined} [adminEmails]
 * @property {string | null} [existingUserId]
 * @property {string | null} [existingCompanyId]
 */

/**
 * Pure planner. `existingUserId` / `existingCompanyId` come from read-only
 * lookups. Returns `{ ok: false, reason }` or `{ ok: true, steps }`.
 */
/** @param {PlanInput} input */
export function planInvite({
  email,
  apply = false,
  withCompany = false,
  adminEmails,
  existingUserId = null,
  existingCompanyId = null,
}) {
  if (!email || !email.includes("@")) {
    return { ok: false, reason: "a valid email argument is required" };
  }
  if (isAllowlisted(email, adminEmails)) {
    return { ok: false, reason: "address is in ADMIN_EMAILS; refusing to treat an admin as a test customer" };
  }
  if (apply && parseAllowlist(adminEmails).length === 0) {
    return { ok: false, reason: "ADMIN_EMAILS is unset locally; refusing to apply (fails closed)" };
  }

  const steps = [existingUserId ? "skip_invite_existing_user" : "invite_user"];
  if (withCompany) {
    steps.push(existingCompanyId ? "reuse_company" : "create_company", "upsert_membership");
  }
  if (apply) steps.push("write_audit");
  return { ok: true, steps };
}

async function findUserByEmail(admin, target) {
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

async function findCompanyByName(admin) {
  const { data, error } = await admin
    .from("companies")
    .select("id")
    .eq("name", COMPANY_NAME)
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? null;
}

async function lowestRankRole(admin) {
  const { data, error } = await admin
    .from("company_roles")
    .select("key")
    .order("rank", { ascending: true })
    .limit(1);
  if (error || !data?.[0]) throw new Error(error?.message ?? "no company roles found");
  return data[0].key;
}

/**
 * @typedef {object} RunInput
 * @property {any} admin
 * @property {string} email
 * @property {boolean} [apply]
 * @property {boolean} [withCompany]
 * @property {string | null | undefined} [adminEmails]
 * @property {string} [redirectTo]
 * @property {(line: string) => void} [log]
 */

/**
 * Runs the plan against `admin` (a service-role Supabase client). Returns
 * `{ exitCode, steps, ids }`. Without `apply` it performs reads only.
 */
/**
 * @param {RunInput} input
 * @returns {Promise<{ exitCode: number, steps: string[], ids: { userId?: string, companyId?: string | null } }>}
 */
export async function runInvite({
  admin,
  email: rawEmail,
  apply = false,
  withCompany = false,
  adminEmails,
  redirectTo,
  log = console.log,
}) {
  // Same normalization as isAdminEmail, applied before the allowlist check and
  // every lookup/invite, so padding or case cannot slip an address past it.
  const email = (rawEmail ?? "").trim().toLowerCase();
  // Refuse before any lookup so a bad address never touches the database.
  const early = planInvite({ email, apply, withCompany, adminEmails });
  if (!early.ok) {
    log(`Refused: ${early.reason}`);
    return { exitCode: 1, steps: [], ids: {} };
  }

  const existingUser = await findUserByEmail(admin, email);
  // The stored address is authoritative: refuse if it is an admin too.
  if (existingUser && isAllowlisted(existingUser.email, adminEmails)) {
    log("Refused: resolved user is in ADMIN_EMAILS; refusing to treat an admin as a test customer");
    return { exitCode: 1, steps: [], ids: {} };
  }
  const existingCompanyId = withCompany ? await findCompanyByName(admin) : null;
  const plan = planInvite({
    email,
    apply,
    withCompany,
    adminEmails,
    existingUserId: existingUser?.id ?? null,
    existingCompanyId,
  });

  log(`Mode: ${apply ? "APPLY" : "dry run (no writes)"}`);
  log(`Planned steps: ${plan.steps.join(", ")}`);
  if (!apply) return { exitCode: 0, steps: plan.steps, ids: {} };

  const ids = {};
  let invited = false;

  if (existingUser) {
    ids.userId = existingUser.id;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error || !data?.user) throw new Error(`invite failed: ${error?.message ?? "no user"}`);
    ids.userId = data.user.id;
    invited = true;
  }

  if (withCompany) {
    ids.companyId = existingCompanyId;
    if (!ids.companyId) {
      const { data, error } = await admin
        .from("companies")
        .insert({ name: COMPANY_NAME })
        .select("id")
        .single();
      if (error || !data) throw new Error(`company create failed: ${error?.message ?? "no row"}`);
      ids.companyId = data.id;
    }
    const role = await lowestRankRole(admin);
    const { error } = await admin
      .from("company_members")
      .upsert(
        { company_id: ids.companyId, user_id: ids.userId, role, status: "active" },
        { onConflict: "company_id,user_id" },
      );
    if (error) throw new Error(`membership upsert failed: ${error.message}`);
  }

  const { error: auditError } = await admin.from("admin_audit_log").insert({
    actor_user_id: null,
    action: AUDIT_ACTION,
    target_type: "user",
    target_id: ids.userId,
    data: { invited, company_id: ids.companyId ?? null },
  });
  if (auditError) log(`Warning: audit log insert failed (non-fatal): ${auditError.code ?? "unknown"}`);

  log(`User id: ${ids.userId}${invited ? " (invited)" : " (already existed)"}`);
  if (ids.companyId) log(`Company id: ${ids.companyId}`);
  return { exitCode: 0, steps: plan.steps, ids };
}

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => a.includes("@"))?.trim().toLowerCase();
  const apply = args.includes("--apply");
  const withCompany = args.includes("--with-company");

  if (!email) {
    console.error("Usage: node scripts/invite-test-customer.mjs <email> [--with-company] [--apply]");
    process.exit(1);
  }

  const { config } = await import("dotenv");
  const { createClient } = await import("@supabase/supabase-js");
  config({ path: ".env.local" });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL || process.env.VERCEL_SUPABASE_URL;
  const serviceRoleKey = process.env.VERCEL_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing VERCEL_SUPABASE_URL / VERCEL_SUPABASE_SERVICE_ROLE_KEY in the environment.");
    process.exit(1);
  }

  console.log(`Target host: ${new URL(supabaseUrl).host}`);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://dobeu.net").replace(/\/$/, "");

  try {
    const { exitCode } = await runInvite({
      admin,
      email,
      apply,
      withCompany,
      adminEmails: process.env.ADMIN_EMAILS,
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/portal")}`,
    });
    process.exit(exitCode);
  } catch (e) {
    console.error(e instanceof Error ? e.message : "unexpected error");
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
