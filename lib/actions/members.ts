"use server";
/**
 * Company-member server actions (multi-tenant layer, Phase 4).
 *
 * House style mirrors lib/actions/{projects,users}.ts: every action returns the
 * discriminated `{ ok }` shape and validates input with zod. Authorization is
 * the COMPANY-scoped guard `requireCompanyAdmin` (rank >= 100 in the extensible
 * `company_roles` catalog), NOT the global ADMIN_EMAILS gate — a company admin
 * manages only their own company's roster. The guard also requires an active
 * company and an AAL2 session (D28), so these actions return
 * `{ ok: false, error: "forbidden" | "mfa_required" }` when either fails.
 *
 * Mutations run through the guard's COOKIE-BOUND client so RLS
 * (`company_members_admin_*` policies, which require rank >= 100 plus an
 * active company and an AAL2 session via public.can_manage_company_members,
 * migration 20261104000200) is the enforcement layer. The service-role client is used ONLY for Supabase Auth
 * admin calls (`listUsers` / `createUser` / `deleteUser`) — there is no
 * cookie-scoped equivalent, and an invitee's auth user may not exist yet.
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
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/utils";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { requireCompanyAdmin } from "@/lib/actions/company-auth";
import { AuthError } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { companyMemberInviteEmail } from "@/lib/resend-templates";
import { safeErrorFields } from "@/lib/log-safe";
import type { DBClient } from "@/lib/actions/auth";

const uuid = z.guid("invalid id");
const roleKey = z
  .string()
  .trim()
  .min(1, "role required")
  .max(64, "role too long");

const inviteInput = z.object({
  companyId: uuid,
  email: z.string().trim().email("invalid email").max(254),
  roleKey,
});

const changeRoleInput = z.object({
  companyId: uuid,
  memberId: uuid,
  roleKey,
});

const deactivateInput = z.object({
  companyId: uuid,
  memberId: uuid,
});

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Rate limiting (mirrors app/api/lead/route.ts): Upstash sliding window when
// configured, else a module-level in-memory per-key bucket.
// ---------------------------------------------------------------------------
const INVITE_RL_WINDOW_MS = 60_000;
const INVITE_RL_MAX = 5;
const inviteBuckets = new Map<string, { count: number; resetAt: number }>();
const upstashReady =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
const upstashRatelimit = upstashReady
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(INVITE_RL_MAX, "1 m"),
      prefix: "action:invite-member",
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
 * Detect Supabase's "already registered" signal from a createUser error, across
 * the shapes it has shipped (message text, `email_exists` code, 422 status).
 */
function isAlreadyRegistered(error: {
  message?: string;
  code?: string;
  status?: number;
}): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    error.code === "email_exists" ||
    error.status === 422
  );
}

/**
 * Find an existing auth user id by email. Pages through the admin list
 * (bounded). Returns null when no user matches or the list call fails.
 */
async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
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

export type InviteMemberData = {
  id: string;
  user_id: string;
  email: string;
  /** True only when the invite email was accepted by Resend. */
  emailSent: boolean;
  /** Present when the membership exists but the invite email did not go out. */
  partial?: "invite_email_failed";
};

/** Send the fixed-copy invite email. Never throws; false means not delivered. */
async function sendInviteEmail(to: string): Promise<boolean> {
  if (!isResendConfigured()) {
    console.warn("[inviteMember] invite email not sent: resend not configured");
    return false;
  }
  try {
    const loginUrl = `${getSiteUrl().replace(/\/$/, "")}/login?next=/company`;
    const tpl = companyMemberInviteEmail({ loginUrl });
    const result = await sendEmail({
      to,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
    if (!result.ok) {
      console.warn("[inviteMember] invite email failed:", safeErrorFields(result.error));
    }
    return result.ok;
  } catch (e) {
    console.warn("[inviteMember] invite email failed:", safeErrorFields(e));
    return false;
  }
}

/**
 * Invite (or attach an already-registered user) as a company member.
 * Guarded by `requireCompanyAdmin`; rate-limited per calling admin.
 *
 * Order matters: the membership row is inserted BEFORE the invite email is
 * sent, so an invitee is never told about a membership that does not exist.
 * The email is fixed copy with no token; the invitee requests their own
 * sign-in link on /login. A failed send leaves the membership in place and
 * returns `ok: true` with `emailSent: false` and `partial`.
 */
export async function inviteMember(
  companyId: string,
  email: string,
  roleKeyArg: string,
): Promise<ActionResult<InviteMemberData>> {
  const parsed = inviteInput.safeParse({
    companyId,
    email,
    roleKey: roleKeyArg,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
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

  // Resolve the invitee's auth user, creating an unconfirmed one if needed.
  // No Supabase email is sent here; the invitee signs in via /login.
  const admin = createAdminClient();
  let invitedUserId = await findUserIdByEmail(admin, input.email);
  let createdByUs = false;
  if (!invitedUserId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: input.email,
      email_confirm: false,
    });
    if (created?.user?.id) {
      invitedUserId = created.user.id;
      createdByUs = true;
    } else if (createErr && isAlreadyRegistered(createErr)) {
      // Lost a race with another signup/invite: use the user that now exists.
      invitedUserId = await findUserIdByEmail(admin, input.email);
    } else {
      console.warn("[inviteMember] createUser failed:", safeErrorFields(createErr));
    }
    if (!invitedUserId) return { ok: false, error: "invite failed" };
  }

  const { data: member, error: insertErr } = await supabase
    .from("company_members")
    .insert({
      company_id: input.companyId,
      user_id: invitedUserId,
      role: input.roleKey,
      status: "invited",
      invited_by: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !member) {
    // Compensate only for a user this call created: a fresh invitee has just a
    // profiles row (ON DELETE CASCADE), so deleting leaves no orphan.
    if (createdByUs) {
      const { error: delErr } = await admin.auth.admin.deleteUser(invitedUserId);
      if (delErr) {
        console.warn("[inviteMember] deleteUser failed:", safeErrorFields(delErr));
      }
    }
    return { ok: false, error: insertErr?.message ?? "member insert failed" };
  }

  revalidatePath("/company");
  revalidatePath("/company/members");

  const emailSent = await sendInviteEmail(input.email);
  return {
    ok: true,
    data: {
      id: member.id,
      user_id: invitedUserId,
      email: input.email,
      emailSent,
      ...(emailSent ? {} : { partial: "invite_email_failed" as const }),
    },
  };
}

/** Change an existing member's role to another catalog role. */
export async function changeMemberRole(
  companyId: string,
  memberId: string,
  roleKeyArg: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = changeRoleInput.safeParse({
    companyId,
    memberId,
    roleKey: roleKeyArg,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
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
  memberId: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = deactivateInput.safeParse({ companyId, memberId });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
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

  if (readErr || !target)
    return { ok: false, error: readErr?.message ?? "member not found" };
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
export async function inviteMemberForm(
  companyId: string,
  formData: FormData,
): Promise<void> {
  const result = await inviteMember(
    companyId,
    String(formData.get("email") ?? ""),
    String(formData.get("roleKey") ?? ""),
  );
  let notice = "invite_failed";
  if (result.ok) {
    notice = result.data.emailSent ? "member_added" : "invite_email_failed";
  } else if (result.error === "rate_limited") {
    notice = "rate_limited";
  }
  const companyParam = uuid.safeParse(companyId).success
    ? `company=${encodeURIComponent(companyId)}&`
    : "";
  // redirect() throws; keep it outside any try/catch.
  redirect(`/company/members?${companyParam}notice=${notice}`);
}

export async function changeMemberRoleForm(
  companyId: string,
  memberId: string,
  formData: FormData,
): Promise<void> {
  await changeMemberRole(
    companyId,
    memberId,
    String(formData.get("roleKey") ?? ""),
  );
}

export async function deactivateMemberForm(
  companyId: string,
  memberId: string,
  _formData: FormData,
): Promise<void> {
  void _formData;
  await deactivateMember(companyId, memberId);
}
