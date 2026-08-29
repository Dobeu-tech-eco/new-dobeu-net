"use server";
/**
 * Company-member server actions (multi-tenant layer, Phase 4).
 *
 * House style mirrors lib/actions/{projects,users}.ts: every action returns the
 * discriminated `{ ok }` shape and validates input with zod. Authorization is
 * the COMPANY-scoped guard `requireCompanyAdmin` (rank >= 100 in the extensible
 * `company_roles` catalog), NOT the global ADMIN_EMAILS gate — a company admin
 * manages only their own company's roster.
 *
 * Mutations run through the guard's COOKIE-BOUND client so RLS
 * (`company_members_admin_*` policies, which require rank >= 100) is the
 * enforcement layer. The service-role client is used ONLY for Supabase Auth
 * admin calls (`inviteUserByEmail` / `listUsers`) — there is no cookie-scoped
 * equivalent, and an invitee's auth user may not exist yet.
 *
 * `inviteMember` is rate-limited per calling admin, mirroring the pattern in
 * app/api/lead/route.ts: an Upstash sliding window when configured, with a
 * module-level in-memory fallback so the limit still applies without Redis.
 *
 * The `*Form` exports are thin FormData adapters so the /company/members page
 * can wire progressive-enhancement `<form action={fn.bind(null, ...)}>` forms
 * without a client component (the page owns no client bundle).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { requireCompanyAdmin } from "@/lib/actions/company-auth";
import { AuthError } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { DBClient } from "@/lib/actions/auth";

const uuid = z.string().uuid("invalid id");
const roleKey = z.string().trim().min(1, "role required").max(64, "role too long");

const inviteInput = z.object({
  companyId: uuid,
  email: z.string().trim().email("invalid email").max(254),
  roleKey
});

const changeRoleInput = z.object({
  companyId: uuid,
  memberId: uuid,
  roleKey
});

const deactivateInput = z.object({
  companyId: uuid,
  memberId: uuid
});

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Rate limiting (mirrors app/api/lead/route.ts): Upstash sliding window when
// configured, else a module-level in-memory per-key bucket.
// ---------------------------------------------------------------------------
const INVITE_RL_WINDOW_MS = 60_000;
const INVITE_RL_MAX = 5;
const inviteBuckets = new Map<string, { count: number; resetAt: number }>();
const upstashReady =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
const upstashRatelimit = upstashReady
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(INVITE_RL_MAX, "1 m"),
      prefix: "action:invite-member"
    })
  : null;

async function isInviteRateLimited(key: string): Promise<boolean> {
  if (upstashRatelimit) {
    const { success } = await upstashRatelimit.limit(key);
    return !success;
  }
  const now = Date.now();
  const b = inviteBuckets.get(key);
  if (!b || b.resetAt < now) {
    inviteBuckets.set(key, { count: 1, resetAt: now + INVITE_RL_WINDOW_MS });
    return false;
  }
  if (b.count >= INVITE_RL_MAX) return true;
  b.count += 1;
  return false;
}

/**
 * Confirm `key` is a real role in the `company_roles` catalog. Any catalog role
 * is allowed (including a second `company_admin` — the caller may intend to
 * promote a co-admin); only unknown keys are rejected, with a clean message
 * rather than surfacing the raw FK-violation from the insert.
 */
async function roleExists(supabase: DBClient, key: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("company_roles")
    .select("key")
    .eq("key", key)
    .single();
  return !error && Boolean(data);
}

/**
 * Find an existing auth user id by email. Used when `inviteUserByEmail` reports
 * the address is already registered — the person still becomes a member, they
 * just don't get a fresh invite email. Pages through the admin list (bounded).
 */
async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (users.length < perPage) break;
  }
  return null;
}

/**
 * Invite (or attach an already-registered user) as a company member.
 * Guarded by `requireCompanyAdmin`; rate-limited per calling admin.
 */
export async function inviteMember(
  companyId: string,
  email: string,
  roleKeyArg: string
): Promise<ActionResult<{ id: string; user_id: string; email: string }>> {
  const parsed = inviteInput.safeParse({ companyId, email, roleKey: roleKeyArg });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;

  let user, supabase;
  try {
    ({ user, supabase } = await requireCompanyAdmin(input.companyId));
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  if (!(await roleExists(supabase, input.roleKey))) {
    return { ok: false, error: `unknown role "${input.roleKey}"` };
  }

  if (await isInviteRateLimited(user.id)) {
    return { ok: false, error: "rate_limited" };
  }

  // Resolve the invitee's auth user: try to invite; if already registered,
  // fall back to a lookup so they're still added (no duplicate email sent).
  const admin = createAdminClient();
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(input.email);
  let invitedUserId = invited?.user?.id ?? null;
  if (!invitedUserId) {
    invitedUserId = await findUserIdByEmail(admin, input.email);
    if (!invitedUserId) {
      return { ok: false, error: inviteErr?.message ?? "invite failed" };
    }
  }

  const { data: member, error: insertErr } = await supabase
    .from("company_members")
    .insert({
      company_id: input.companyId,
      user_id: invitedUserId,
      role: input.roleKey,
      status: "invited",
      invited_by: user.id
    })
    .select("id")
    .single();

  if (insertErr || !member) {
    return { ok: false, error: insertErr?.message ?? "member insert failed" };
  }

  revalidatePath("/company");
  revalidatePath("/company/members");
  return { ok: true, data: { id: member.id, user_id: invitedUserId, email: input.email } };
}

/** Change an existing member's role to another catalog role. */
export async function changeMemberRole(
  companyId: string,
  memberId: string,
  roleKeyArg: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = changeRoleInput.safeParse({ companyId, memberId, roleKey: roleKeyArg });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;

  let supabase;
  try {
    ({ supabase } = await requireCompanyAdmin(input.companyId));
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  if (!(await roleExists(supabase, input.roleKey))) {
    return { ok: false, error: `unknown role "${input.roleKey}"` };
  }

  const { error } = await supabase
    .from("company_members")
    .update({ role: input.roleKey })
    .eq("id", input.memberId)
    .eq("company_id", input.companyId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/company/members");
  return { ok: true, data: { id: input.memberId } };
}

/** Disable a member (status='disabled'). A caller cannot disable themselves. */
export async function deactivateMember(
  companyId: string,
  memberId: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = deactivateInput.safeParse({ companyId, memberId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const input = parsed.data;

  let user, supabase;
  try {
    ({ user, supabase } = await requireCompanyAdmin(input.companyId));
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data: target, error: readErr } = await supabase
    .from("company_members")
    .select("id, user_id")
    .eq("id", input.memberId)
    .eq("company_id", input.companyId)
    .single();

  if (readErr || !target) return { ok: false, error: readErr?.message ?? "member not found" };
  if (target.user_id === user.id) {
    return { ok: false, error: "cannot disable yourself" };
  }

  const { error } = await supabase
    .from("company_members")
    .update({ status: "disabled" })
    .eq("id", input.memberId)
    .eq("company_id", input.companyId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/company/members");
  return { ok: true, data: { id: input.memberId } };
}

// ---------------------------------------------------------------------------
// FormData adapters for progressive-enhancement <form action> usage. The page
// binds the leading ids; React appends the FormData as the final argument.
// They return void (the form ignores the result) so the typed core actions
// stay the tested, value-returning API.
// ---------------------------------------------------------------------------
export async function inviteMemberForm(companyId: string, formData: FormData): Promise<void> {
  await inviteMember(
    companyId,
    String(formData.get("email") ?? ""),
    String(formData.get("roleKey") ?? "")
  );
}

export async function changeMemberRoleForm(
  companyId: string,
  memberId: string,
  formData: FormData
): Promise<void> {
  await changeMemberRole(companyId, memberId, String(formData.get("roleKey") ?? ""));
}

export async function deactivateMemberForm(
  companyId: string,
  memberId: string,
  _formData: FormData
): Promise<void> {
  void _formData;
  await deactivateMember(companyId, memberId);
}
