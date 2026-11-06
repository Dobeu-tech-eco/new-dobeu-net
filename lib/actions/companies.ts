"use server";
/**
 * Super-admin company server actions (Phase 3 — multi-tenant layer).
 *
 * Every action requires `requireAdmin()` (ADMIN_EMAILS gate + service-role
 * client). Callers live under `app/admin/companies/*`, which is already gated
 * at the admin layout level. Mirrors `lib/actions/projects.ts`:
 *   - discriminated `{ ok: true, data } | { ok: false, error }` returns
 *   - zod-validated inputs
 *   - service-role mutations (admin reads/writes bypass RLS by convention)
 *
 * Audit trail: EVERY action records an `admin_audit_log` row (actor, action,
 * target_type 'company', target_id, jsonb data). The audit write is best-effort
 * (non-fatal) so an audit-table hiccup never rolls back a completed provisioning
 * action — mirrors the "side effects never break the primary op" discipline in
 * `lib/actions/work-orders.ts`.
 *
 * `provisionCompanyAdmin` follows the `inviteMember` pattern (lib/actions/
 * members.ts): resolve or create the user (confirmed, no Supabase email), insert
 * the 'invited' company_admin membership FIRST, then send the fixed-copy invite
 * email. The invitee signs in with an emailed link and accepts on /portal.
 */
import { revalidatePath } from "next/cache";
import { getSiteUrl } from "@/lib/utils";
import { z } from "zod";
import { requireAdmin, AuthError } from "@/lib/actions/auth";
import { writeAdminAudit } from "@/lib/admin-audit";
import { findUserIdByEmail, isAlreadyRegistered } from "@/lib/auth-admin";
import { hasCurrentEmailLinkSignIn } from "@/lib/email-link-signin";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { companyMemberInviteEmail } from "@/lib/resend-templates";
import { safeErrorFields } from "@/lib/log-safe";
import type { createAdminClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

const uuid = z.guid("invalid id");

const createInput = z.object({
  name: z.string().trim().min(2, "name too short").max(160, "name too long"),
});

const idInput = z.object({ id: uuid });

const provisionInput = z.object({
  companyId: uuid,
  email: z.string().trim().email("invalid email").max(254),
});

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

export async function createCompany(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const { name } = parsed.data;

  let user, admin;
  try {
    ({ user, admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data, error } = await admin
    .from("companies")
    .insert({ name, created_by: user.id })
    .select("id")
    .single();

  if (error || !data)
    return { ok: false, error: error?.message ?? "insert failed" };

  await writeAdminAudit(admin, {
    actorUserId: user.id,
    action: "company.create",
    targetType: "company",
    targetId: data.id,
    data: {},
    logScope: "companies",
  });

  revalidatePath("/admin/companies");
  return { ok: true, data: { id: data.id } };
}

/**
 * Flip a company's `status` and record the change. Shared by
 * `suspendCompany` / `reactivateCompany`.
 */
async function setCompanyStatus(
  raw: unknown,
  status: "active" | "suspended",
  action: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = idInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const { id } = parsed.data;

  let user, admin;
  try {
    ({ user, admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { error } = await admin
    .from("companies")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await writeAdminAudit(admin, {
    actorUserId: user.id,
    action,
    targetType: "company",
    targetId: id,
    data: { status },
    logScope: "companies",
  });

  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${id}`);
  return { ok: true, data: { id } };
}

export async function suspendCompany(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return setCompanyStatus(raw, "suspended", "company.suspend");
}

export async function reactivateCompany(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return setCompanyStatus(raw, "active", "company.reactivate");
}

/**
 * Resolve the invitee's auth user. createUser goes FIRST; only an "already
 * registered" answer falls back to the direct email lookup. `createdByUs` is
 * true only for a user this call created, so the compensating delete can never
 * remove a pre-existing account. New users are created CONFIRMED so the public
 * signUp cannot plant a password on them (see inviteMember).
 */
async function resolveInviteeUserId(
  admin: AdminClient,
  email: string,
): Promise<{ id: string; createdByUs: boolean } | null> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error && isAlreadyRegistered(error)) {
    const returned = (data as { user?: { id?: string } | null } | null)?.user?.id;
    const id = returned ?? (await findUserIdByEmail(admin, email));
    return id ? { id, createdByUs: false } : null;
  }
  if (error || !data?.user?.id) {
    console.warn("[companies] createUser failed:", safeErrorFields(error));
    return null;
  }
  return { id: data.user.id, createdByUs: true };
}

/** True if the user has any membership (or the check fails: fail safe, keep). */
async function userHasMembership(
  admin: AdminClient,
  userId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from("company_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.warn("[companies] membership check failed:", safeErrorFields(error));
    return true;
  }
  return (count ?? 0) > 0;
}

/** Send the fixed-copy invite email. Never throws; false means not delivered. */
async function sendProvisionEmail(to: string): Promise<boolean> {
  if (!isResendConfigured()) {
    console.warn("[companies] invite email not sent: resend not configured");
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
      console.warn("[companies] invite email failed:", safeErrorFields(result.error));
    }
    return result.ok;
  } catch (e) {
    console.warn("[companies] invite email failed:", safeErrorFields(e));
    return false;
  }
}

/**
 * Provision a user as this company's admin.
 *
 * Order matters: the 'invited' membership row is written BEFORE the invite
 * email, so nobody is told about a membership that does not exist. No Supabase
 * invite link is sent; the invitee requests their own sign-in link on /login and
 * accepts from "Pending company invites" on /portal.
 *
 * Attach-time guard: an EXISTING account (one this call did not create) is
 * attached only if its current email was proven by an email-link sign-in
 * (`hasCurrentEmailLinkSignIn`); otherwise `invitee_needs_link_signin`, with no
 * insert and no email.
 *
 * An existing membership row is promoted to `company_admin` (an active row stays
 * active; any other status returns to 'invited'). A 23505 on insert means a
 * concurrent request added the row: never delete the user then (the FK cascades).
 */
export async function provisionCompanyAdmin(raw: unknown): Promise<
  ActionResult<{
    userId: string;
    status: "invited" | "active";
    emailSent: boolean;
  }>
> {
  const parsed = provisionInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const { companyId, email } = parsed.data;

  let user, admin;
  try {
    ({ user, admin } = await requireAdmin());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // Confirm the company exists first — a clean error beats an FK failure.
  const { data: company, error: companyErr } = await admin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .single();
  if (companyErr || !company) return { ok: false, error: "company not found" };

  const invitee = await resolveInviteeUserId(admin, email);
  if (!invitee) return { ok: false, error: "invite failed" };
  const userId = invitee.id;

  if (!invitee.createdByUs) {
    const { data: existing, error: lookupErr } =
      await admin.auth.admin.getUserById(userId);
    if (lookupErr || !existing?.user) {
      console.warn("[companies] user lookup failed:", safeErrorFields(lookupErr));
      return { ok: false, error: "invite failed" };
    }
    if (!hasCurrentEmailLinkSignIn(existing.user)) {
      return { ok: false, error: "invitee_needs_link_signin" };
    }
  }

  // Promote an existing membership, or insert a fresh company_admin row.
  const { data: existingMember } = await admin
    .from("company_members")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .single();

  let memberStatus: "invited" | "active" = "invited";

  if (existingMember) {
    if (existingMember.status === "active") memberStatus = "active";
    const { error } = await admin
      .from("company_members")
      .update({
        role: "company_admin",
        status: memberStatus,
        invited_by: user.id,
      })
      .eq("id", existingMember.id);
    if (error) return { ok: false, error: "invite failed" };
  } else {
    const { error } = await admin.from("company_members").insert({
      company_id: companyId,
      user_id: userId,
      role: "company_admin",
      status: memberStatus,
      invited_by: user.id,
    });
    if (error) {
      const duplicate = error.code === "23505";
      if (
        !duplicate &&
        invitee.createdByUs &&
        !(await userHasMembership(admin, userId))
      ) {
        const { error: delErr } = await admin.auth.admin.deleteUser(userId);
        if (delErr) {
          console.warn("[companies] deleteUser failed:", safeErrorFields(delErr));
        }
      }
      return {
        ok: false,
        error: duplicate ? "already_member" : "invite failed",
      };
    }
  }

  await writeAdminAudit(admin, {
    actorUserId: user.id,
    action: "company.provision_admin",
    targetType: "company",
    targetId: companyId,
    data: { user_id: userId, status: memberStatus },
    logScope: "companies",
  });

  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);

  const emailSent =
    memberStatus === "invited" ? await sendProvisionEmail(email) : false;
  return { ok: true, data: { userId, status: memberStatus, emailSent } };
}
