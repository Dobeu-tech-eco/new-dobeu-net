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
 * `inviteMember` is rate-limited twice via lib/rate-limit.ts `checkRateLimit`
 * (Upstash when configured, in-memory fallback): per calling admin per minute,
 * then per company per 24h. A limiter failure fails closed as `rate_limited`.
 *
 * The `*Form` exports are thin FormData adapters so the /company/members page
 * can wire progressive-enhancement `<form action={fn.bind(null, ...)}>` forms
 * without a client component (the page owns no client bundle).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSiteUrl } from "@/lib/utils";
import { z } from "zod";
import { requireCompanyAdmin } from "@/lib/actions/company-auth";
import { AuthError } from "@/lib/actions/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { companyMemberInviteEmail } from "@/lib/resend-templates";
import { safeErrorFields } from "@/lib/log-safe";
import { checkRateLimit } from "@/lib/rate-limit";
import { findUserIdByEmail, isAlreadyRegistered } from "@/lib/auth-admin";
import { hasCurrentEmailLinkSignIn } from "@/lib/email-link-signin";
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
// Rate limiting: per admin per minute, then per company per 24h.
// ---------------------------------------------------------------------------
const INVITE_MINUTE = { windowSec: 60, max: 5 } as const;
const INVITE_DAILY = { windowSec: 86_400, max: 20 } as const;

/** Fixed notice codes emitted by inviteMemberForm (read by the members page). */
export type InviteNoticeCode =
  | "member_added"
  | "invite_email_failed"
  | "rate_limited"
  | "daily_limit"
  | "already_member"
  | "invitee_needs_link_signin"
  | "invite_failed";

/** Returns the limiter that tripped, or null. Fails closed if the limiter throws. */
async function inviteLimitHit(
  userId: string,
  companyId: string,
): Promise<"rate_limited" | "daily_limit" | null> {
  try {
    const perMinute = await checkRateLimit(`invite:min:${userId}`, INVITE_MINUTE);
    if (perMinute.limited) return "rate_limited";
    const daily = await checkRateLimit(`invite:day:${companyId}`, INVITE_DAILY);
    return daily.limited ? "daily_limit" : null;
  } catch (e) {
    console.warn("[inviteMember] rate limiter failed:", safeErrorFields(e));
    return "rate_limited";
  }
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
 * Resolve the invitee's auth user. createUser goes FIRST (no per-invite paging
 * for new emails); only an "already registered" answer falls back to the email
 * lookup. `createdByUs` is true only for a user this call created, so the
 * compensating delete can never remove a pre-existing account.
 */
async function resolveInviteeUserId(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<{ id: string; createdByUs: boolean } | null> {
  // Created CONFIRMED: an unconfirmed user lets anyone call the public signUp
  // for this address and get a session on it (auto-confirm config), then set
  // a password that survives the invitee's accept. Confirmed, signUp returns no
  // session. The invitee still proves the mailbox with an emailed link.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error && isAlreadyRegistered(error)) {
    // Some shapes return a user id alongside the error; prefer it over paging.
    const returned = (data as { user?: { id?: string } | null } | null)?.user?.id;
    const id = returned ?? (await findUserIdByEmail(admin, email));
    return id ? { id, createdByUs: false } : null;
  }
  if (error || !data?.user?.id) {
    console.warn("[inviteMember] createUser failed:", safeErrorFields(error));
    return null;
  }
  return { id: data.user.id, createdByUs: true };
}

/** True if the user has any membership (or the check fails: fail safe, keep). */
async function userHasMembership(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from("company_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.warn("[inviteMember] membership check failed:", safeErrorFields(error));
    return true;
  }
  return (count ?? 0) > 0;
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
    const loginUrl = `${getSiteUrl().replace(/\/$/, "")}/login?next=/portal`;
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
 * sign-in link on /login (next=/portal), then accepts the invite from the
 * "Pending company invites" list on their portal. A failed send leaves the
 * membership in place and returns `ok: true` with `emailSent: false` and
 * `partial`.
 *
 * Attach-time squatter guard: an EXISTING account (one this call did not
 * create) is attached only if its current email was proven by an email-link
 * sign-in (`hasCurrentEmailLinkSignIn`), whether or not it has ever signed in
 * or is confirmed; otherwise `invitee_needs_link_signin`, with no insert and
 * no email.
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
    return { ok: false, error: "unknown_role" };
  }

  const limit = await inviteLimitHit(user.id, input.companyId);
  if (limit) return { ok: false, error: limit };

  // No Supabase email is sent here; the invitee signs in via /login.
  const admin = createAdminClient();
  const invitee = await resolveInviteeUserId(admin, input.email);
  if (!invitee) return { ok: false, error: "invite failed" };
  const invitedUserId = invitee.id;

  if (!invitee.createdByUs) {
    const { data: existing, error: lookupErr } =
      await admin.auth.admin.getUserById(invitedUserId);
    if (lookupErr || !existing?.user) {
      console.warn("[inviteMember] user lookup failed:", safeErrorFields(lookupErr));
      return { ok: false, error: "invite failed" };
    }
    // Every existing account needs the marker, whatever last_sign_in_at says:
    // with hosted Confirm email ON, a public signUp leaves an unconfirmed
    // account with a planted password and no session (D64).
    if (!hasCurrentEmailLinkSignIn(existing.user)) {
      return { ok: false, error: "invitee_needs_link_signin" };
    }
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
    const duplicate = insertErr?.code === "23505";
    // A unique violation proves another request just inserted a membership for
    // this user, and company_members.user_id is ON DELETE CASCADE: deleting the
    // user would remove it. Never compensate on 23505. For other errors, delete
    // only a user this call created AND that still has no memberships. Accepted
    // residual risk: a concurrent request could attach one between the count and
    // the delete; the window is tiny and the user was created seconds ago.
    if (
      !duplicate &&
      invitee.createdByUs &&
      !(await userHasMembership(admin, invitedUserId))
    ) {
      const { error: delErr } = await admin.auth.admin.deleteUser(invitedUserId);
      if (delErr) {
        console.warn("[inviteMember] deleteUser failed:", safeErrorFields(delErr));
      }
    }
    // Fixed codes only: never hand a Supabase message back to callers.
    return {
      ok: false,
      error: duplicate ? "already_member" : "invite failed",
    };
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
    return { ok: false, error: "unknown_role" };
  }

  const { data: updated, error } = await supabase
    .from("company_members")
    .update({ role: input.roleKey })
    .eq("id", input.memberId)
    .eq("company_id", input.companyId)
    .select("id");

  if (error) {
    console.warn("[changeMemberRole] update failed:", safeErrorFields(error));
    return { ok: false, error: "role change failed" };
  }
  if (!updated || updated.length === 0) return { ok: false, error: "not_found" };

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

  if (readErr || !target) {
    if (readErr && readErr.code !== "PGRST116") {
      console.warn("[deactivateMember] read failed:", safeErrorFields(readErr));
      return { ok: false, error: "deactivate failed" };
    }
    return { ok: false, error: "not_found" };
  }
  if (target.user_id === user.id) {
    return { ok: false, error: "cannot disable yourself" };
  }

  const { error } = await supabase
    .from("company_members")
    .update({ status: "disabled" })
    .eq("id", input.memberId)
    .eq("company_id", input.companyId);

  if (error) {
    console.warn("[deactivateMember] update failed:", safeErrorFields(error));
    return { ok: false, error: "deactivate failed" };
  }

  revalidatePath("/company/members");
  return { ok: true, data: { id: input.memberId } };
}

// ---------------------------------------------------------------------------
// FormData adapters for progressive-enhancement <form action> usage. The page
// binds the leading ids; React appends the FormData as the final argument.
// They return void and redirect with a fixed notice code so the typed core
// actions stay the tested, value-returning API.
// ---------------------------------------------------------------------------
// Guard failures (mfa_required, forbidden, not_authenticated) return null: the
// page guard already routes the user (step-up / guard notice), so a carried
// notice would only show stale on the step-up deep link.
function inviteNotice(
  result: ActionResult<InviteMemberData>,
): InviteNoticeCode | null {
  if (result.ok) {
    return result.data.emailSent ? "member_added" : "invite_email_failed";
  }
  switch (result.error) {
    case "rate_limited":
    case "daily_limit":
    case "already_member":
    case "invitee_needs_link_signin":
      return result.error;
    case "forbidden":
    case "not_authenticated":
    case "mfa_required":
      return null;
    default:
      return "invite_failed";
  }
}

function redirectToMembers(companyId: string, notice: string | null): never {
  const companyParam = uuid.safeParse(companyId).success
    ? `company=${encodeURIComponent(companyId)}&`
    : "";
  const noticeParam = notice ? `notice=${notice}` : "";
  // redirect() throws; keep it outside any try/catch.
  redirect(`/company/members?${companyParam}${noticeParam}`.replace(/[?&]$/, ""));
}

export async function inviteMemberForm(
  companyId: string,
  formData: FormData,
): Promise<void> {
  const result = await inviteMember(
    companyId,
    String(formData.get("email") ?? ""),
    String(formData.get("roleKey") ?? ""),
  );
  redirectToMembers(companyId, inviteNotice(result));
}

/** Fixed notice codes emitted by changeMemberRoleForm / deactivateMemberForm. */
export type MemberActionNoticeCode =
  | "role_changed"
  | "role_change_failed"
  | "member_deactivated"
  | "deactivate_failed"
  | "cannot_disable_self"
  | "not_found"
  | "unknown_role";

function memberActionNotice(
  result: ActionResult<unknown>,
  success: MemberActionNoticeCode,
  failure: MemberActionNoticeCode,
): MemberActionNoticeCode | null {
  if (result.ok) return success;
  switch (result.error) {
    case "not_found":
    case "unknown_role":
      return result.error;
    case "cannot disable yourself":
      return "cannot_disable_self";
    case "forbidden":
    case "not_authenticated":
    case "mfa_required":
      return null;
    default:
      return failure;
  }
}

export async function changeMemberRoleForm(
  companyId: string,
  memberId: string,
  formData: FormData,
): Promise<void> {
  const result = await changeMemberRole(
    companyId,
    memberId,
    String(formData.get("roleKey") ?? ""),
  );
  redirectToMembers(
    companyId,
    memberActionNotice(result, "role_changed", "role_change_failed"),
  );
}

export async function deactivateMemberForm(
  companyId: string,
  memberId: string,
  _formData: FormData,
): Promise<void> {
  void _formData;
  const result = await deactivateMember(companyId, memberId);
  redirectToMembers(
    companyId,
    memberActionNotice(result, "member_deactivated", "deactivate_failed"),
  );
}
