"use server";
/**
 * Company invite accept / decline (D47).
 *
 * The invitee explicitly accepts or declines; nothing happens on sign-in.
 * Order is load-bearing: `requireUser()` (cookie-bound) first, then the
 * confirmed-email check and the session's sign-in methods, and only THEN the
 * service-role client is created. `respondToInvite` requires an email-link
 * sign-in made after the invite (`checkMailboxProof`); a password-only
 * session is refused. Accept additionally needs a 24 h email-change quiet
 * period (decline does not: it only deletes the caller's own row). After an accept
 * commits, the company status is re-checked and the activation reverted if it
 * was suspended, and the user's other sessions are revoked. The membership
 * write itself is service-role (clients cannot activate members: see
 * enforce_company_member_activation) and is scoped to the caller's own
 * `invited` row inside `respondToInvite`.
 *
 * No AAL2 and no rate limit here by decision: accepting only activates the
 * caller's own row, and an admin role still hits the /company step-up gate.
 * Errors surface as fixed codes, never raw Supabase messages.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { writeAdminAuditStrict } from "@/lib/admin-audit";
import { AuthError, requireUser } from "@/lib/actions/auth";
import {
  loadSessionMethods,
  respondToInvite,
  type InviteResponse,
} from "@/lib/company-invites";
import { safeErrorFields } from "@/lib/log-safe";
import { createAdminClient } from "@/lib/supabase/server";

const uuid = z.guid("invalid id");

type RespondData = {
  companyId: string;
  isAdminRole: boolean;
  /** Accepted, but the company is suspended and the activation was not undone. */
  companyInactive?: boolean;
  /** Committed, but the audit row could not be written (D58). */
  auditFailed?: boolean;
  /** Accepted, but the earlier password could not be cleared (D55). */
  passwordRotationFailed?: boolean;
};

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

/** Fixed notice codes carried to /portal?notice= (read by the portal page). */
export type InviteResponseNoticeCode =
  | "invite_accepted"
  | "invite_accepted_company_inactive"
  | "invite_declined"
  | "invite_unavailable"
  | "invite_email_unconfirmed"
  | "invite_signin_stale"
  | "invite_email_changed"
  | "invite_company_inactive"
  | "invite_already_accepted"
  | "invite_response_failed";

/** Failure codes the core can return that map one-to-one to a notice. */
const PASS_THROUGH_FAILURES: ReadonlySet<string> = new Set<InviteResponseNoticeCode>([
  "invite_unavailable",
  "invite_email_unconfirmed",
  "invite_signin_stale",
  "invite_email_changed",
  "invite_company_inactive",
  "invite_already_accepted",
]);

async function respond(
  memberId: string,
  response: InviteResponse,
): Promise<ActionResult<RespondData>> {
  try {
    const { user, supabase } = await requireUser();
    if (!user.email_confirmed_at) {
      return { ok: false, error: "invite_email_unconfirmed" };
    }
    const id = uuid.safeParse(memberId);
    if (!id.success) {
      return { ok: false, error: "invite_unavailable" };
    }
    const methods = await loadSessionMethods(supabase);
    if (!methods) return { ok: false, error: "invite_response_failed" };

    const admin = createAdminClient();
    const result = await respondToInvite(
      admin,
      user.id,
      id.data,
      response,
      {
        methods,
        identities: user.identities,
        emailChangeSentAt: user.email_change_sent_at ?? null,
      },
    );
    if (!result.ok) return result;

    let auditFailed = result.auditFailed === true;
    let passwordRotationFailed = false;
    if (response === "accept") {
      // The accepted address now carries membership: end any session an earlier
      // squatter may hold. Non-fatal; the accept already committed.
      try {
        const { error } = await supabase.auth.signOut({ scope: "others" });
        if (error) {
          console.warn("[acceptCompanyInvite] revoke others failed:", safeErrorFields(error));
        }
      } catch (e) {
        console.warn("[acceptCompanyInvite] revoke others failed:", safeErrorFields(e));
      }
      // Clear any password set before mailbox proof (D55): replace it with a
      // random one that is never logged or returned. Sign-in stays by email
      // link. Non-fatal: the accept already committed.
      let rotated = false;
      try {
        const { error } = await admin.auth.admin.updateUserById(user.id, {
          password: randomBytes(32).toString("base64url"),
        });
        if (error) throw error;
        rotated = true;
      } catch (e) {
        passwordRotationFailed = true;
        console.warn("[acceptCompanyInvite] password rotation failed:", safeErrorFields(e));
      }
      const audited = await writeAdminAuditStrict(admin, {
        actorUserId: user.id,
        action: rotated
          ? "company_member.password_rotated"
          : "company_member.password_rotation_failed",
        targetType: "company",
        targetId: result.companyId,
        data: { member_id: id.data, user_id: user.id },
        logScope: "company-invite-accept",
      });
      if (!audited) auditFailed = true;
    }

    revalidatePath("/portal");
    revalidatePath("/company");
    return {
      ok: true,
      data: {
        companyId: result.companyId,
        isAdminRole: result.isAdminRole,
        ...(result.companyInactive ? { companyInactive: true } : {}),
        ...(auditFailed ? { auditFailed: true } : {}),
        ...(passwordRotationFailed ? { passwordRotationFailed: true } : {}),
      },
    };
  } catch (e) {
    if (e instanceof AuthError && e.code === "not_authenticated") {
      return { ok: false, error: "not_authenticated" };
    }
    console.warn(`[${response}CompanyInvite] failed:`, safeErrorFields(e));
    return { ok: false, error: "invite_response_failed" };
  }
}

export async function acceptCompanyInvite(
  memberId: string,
): Promise<ActionResult<RespondData>> {
  return respond(memberId, "accept");
}

/** Works for a suspended company too: leaving an invite never needs it active. */
export async function declineCompanyInvite(
  memberId: string,
): Promise<ActionResult<RespondData>> {
  return respond(memberId, "decline");
}

function failureRedirect(error: string): string {
  // A missing session is the login page's job; no stale notice (L-030).
  if (error === "not_authenticated") return "/login?next=/portal";
  const notice = PASS_THROUGH_FAILURES.has(error) ? error : "invite_response_failed";
  return `/portal?notice=${notice}`;
}

export async function acceptCompanyInviteForm(
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bound form action signature
  _formData: FormData,
): Promise<void> {
  const result = await acceptCompanyInvite(memberId);
  // redirect() throws; keep it outside any try/catch.
  if (!result.ok) redirect(failureRedirect(result.error));
  // A suspended company's /company pages are refused, so never send it there.
  if (result.data.companyInactive) {
    redirect("/portal?notice=invite_accepted_company_inactive");
  }
  redirect(
    result.data.isAdminRole
      ? `/company?company=${encodeURIComponent(result.data.companyId)}`
      : "/portal?notice=invite_accepted",
  );
}

export async function declineCompanyInviteForm(
  memberId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bound form action signature
  _formData: FormData,
): Promise<void> {
  const result = await declineCompanyInvite(memberId);
  if (!result.ok) redirect(failureRedirect(result.error));
  redirect("/portal?notice=invite_declined");
}
