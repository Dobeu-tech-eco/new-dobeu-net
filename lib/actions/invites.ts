"use server";
/**
 * Company invite accept / decline (D47).
 *
 * The invitee explicitly accepts or declines; nothing happens on sign-in.
 * Order is load-bearing: `requireUser()` (cookie-bound) first, then the
 * confirmed-email check and the email-link session requirement
 * (`requireMailboxProof`: a password-only session is refused), and only THEN
 * the service-role client is created. After an accept commits, the company
 * status is re-checked and the activation reverted if it was suspended. The membership write itself is service-role (clients cannot
 * activate members: see enforce_company_member_activation) and is scoped to
 * the caller's own `invited` row inside `respondToInvite`.
 *
 * No AAL2 and no rate limit here by decision: accepting only activates the
 * caller's own row, and an admin role still hits the /company step-up gate.
 * Errors surface as fixed codes, never raw Supabase messages.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/actions/auth";
import {
  requireMailboxProof,
  respondToInvite,
  type InviteResponse,
} from "@/lib/company-invites";
import { safeErrorFields } from "@/lib/log-safe";
import { createAdminClient } from "@/lib/supabase/server";

const uuid = z.guid("invalid id");

type RespondData = { companyId: string; isAdminRole: boolean };

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

/** Fixed notice codes carried to /portal?notice= (read by the portal page). */
export type InviteResponseNoticeCode =
  | "invite_accepted"
  | "invite_declined"
  | "invite_unavailable"
  | "invite_email_unconfirmed"
  | "invite_response_failed";

async function respond(
  memberId: string,
  response: InviteResponse,
): Promise<ActionResult<RespondData>> {
  try {
    const { user, supabase } = await requireUser();
    if (!user.email_confirmed_at) {
      return { ok: false, error: "invite_email_unconfirmed" };
    }
    const proofError = await requireMailboxProof(supabase);
    if (proofError) return { ok: false, error: proofError };
    const id = uuid.safeParse(memberId);
    if (!id.success) {
      return { ok: false, error: "invite_unavailable" };
    }

    const result = await respondToInvite(
      createAdminClient(),
      user.id,
      id.data,
      response,
    );
    if (!result.ok) return result;

    revalidatePath("/portal");
    revalidatePath("/company");
    return {
      ok: true,
      data: { companyId: result.companyId, isAdminRole: result.isAdminRole },
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
  const notice: InviteResponseNoticeCode =
    error === "invite_unavailable" || error === "invite_email_unconfirmed"
      ? error
      : "invite_response_failed";
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
