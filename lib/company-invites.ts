/**
 * Company invite helpers (D47). NOT a "use server" module: nothing here is
 * callable from the client. Callers (lib/actions/invites.ts, the portal page)
 * authenticate the user first and pass a service-role client plus the verified
 * user id; every query below is scoped to that id, so one user can never read
 * or change another user's membership row.
 */
import { COMPANY_ADMIN_RANK } from "@/lib/actions/company-auth";
import type { DBClient } from "@/lib/actions/auth";
import { writeAdminAudit } from "@/lib/admin-audit";
import { safeErrorFields } from "@/lib/log-safe";
import { createAdminClient } from "@/lib/supabase/server";

export type InviteFailure = "invite_unavailable" | "invite_response_failed";

export type InviteResponse = "accept" | "decline";

export type InviteResponseResult =
  | { ok: true; companyId: string; isAdminRole: boolean }
  | { ok: false; error: InviteFailure };

export type PendingInvite = {
  memberId: string;
  companyId: string;
  companyName: string;
  role: string;
  roleLabel: string;
  isAdminRole: boolean;
};

type RoleInfo = { label: string; rank: number };

function isAdminRank(roles: Map<string, RoleInfo>, role: string): boolean {
  return (roles.get(role)?.rank ?? 0) >= COMPANY_ADMIN_RANK;
}

/** Throws on a read error; a missing company counts as not active. */
async function isCompanyActive(
  admin: DBClient,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("companies")
    .select("status")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data?.status === "active";
}

/**
 * Sign-in methods that prove control of the mailbox (not password or totp).
 * NOTE: `otp` is also emitted by phone/SMS OTP; this gate assumes phone
 * sign-in stays disabled (supabase/config.toml [auth.sms] enable_signup =
 * false; see D52).
 */
const MAILBOX_PROOF_METHODS: ReadonlySet<string> = new Set([
  "otp",
  "magiclink",
  "invite",
  "email/signup",
]);

/**
 * `email_confirmed_at` alone is not mailbox proof (signups may auto-confirm,
 * so a squatter can register a victim's address). Require that the current
 * session was established through an email link. Returns null when proven.
 */
export async function requireMailboxProof(
  supabase: DBClient,
): Promise<null | "invite_email_unconfirmed" | "invite_response_failed"> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return "invite_response_failed";
  const proven = data.currentAuthenticationMethods.some((m) =>
    MAILBOX_PROOF_METHODS.has(typeof m === "string" ? m : m.method),
  );
  return proven ? null : "invite_email_unconfirmed";
}

async function loadRoles(
  admin: DBClient,
): Promise<Map<string, RoleInfo> | null> {
  const { data, error } = await admin
    .from("company_roles")
    .select("key, label, rank");
  if (error || !data) return null;
  return new Map(data.map((r) => [r.key, { label: r.label, rank: r.rank }]));
}

/** The invitee's pending invites for ACTIVE companies. Read errors fail soft. */
export async function listPendingInvites(
  userId: string,
): Promise<{ invites: PendingInvite[]; error: boolean }> {
  const failed = { invites: [], error: true };
  try {
    const admin = createAdminClient() as DBClient;

    const { data: rows, error } = await admin
      .from("company_members")
      .select("id, company_id, role")
      .eq("user_id", userId)
      .eq("status", "invited");
    if (error || !rows) return failed;
    if (rows.length === 0) return { invites: [], error: false };

    const { data: companies, error: companiesError } = await admin
      .from("companies")
      .select("id, name")
      .in("id", [...new Set(rows.map((r) => r.company_id))])
      .eq("status", "active");
    if (companiesError || !companies) return failed;
    const roles = await loadRoles(admin);
    if (!roles) return failed;

    const nameById = new Map(companies.map((c) => [c.id, c.name]));
    const invites = rows.flatMap((r) => {
      const companyName = nameById.get(r.company_id);
      if (companyName === undefined) return [];
      const info = roles.get(r.role);
      return [
        {
          memberId: r.id,
          companyId: r.company_id,
          companyName,
          role: r.role,
          roleLabel: info?.label ?? r.role,
          isAdminRole: isAdminRank(roles, r.role),
        },
      ];
    });
    return { invites, error: false };
  } catch (e) {
    console.warn("[listPendingInvites] read failed:", safeErrorFields(e));
    return failed;
  }
}

type MemberRow = { company_id: string; role: string };

/** A write that committed (`row`) or one that changed nothing (`error`). */
type Applied =
  | {
      row: MemberRow;
      isAdminRole: boolean;
      /** Extra audit fields when the log must describe an inconsistent state. */
      auditExtra?: Record<string, boolean>;
      /** Set when the row stays written but the caller must still be refused. */
      refuse?: InviteFailure;
    }
  | { error: InviteFailure };

/**
 * Accept: read own invited row, require an ACTIVE company, then activate.
 * Throws only BEFORE the update commits; everything after is handled inline so
 * the row and the audit log can never disagree with the reported result.
 */
async function acceptInvite(
  admin: DBClient,
  userId: string,
  memberId: string,
  scope: string,
): Promise<Applied> {
  const { data: current, error } = await admin
    .from("company_members")
    .select("company_id, role")
    .eq("id", memberId)
    .eq("user_id", userId)
    .eq("status", "invited")
    .maybeSingle();
  if (error) throw error;
  if (!current) return { error: "invite_unavailable" };
  if (!(await isCompanyActive(admin, current.company_id))) {
    return { error: "invite_unavailable" };
  }

  // Resolve the catalog before writing so a read failure cannot leave an
  // accepted invite that reports an error.
  const roles = await loadRoles(admin);
  if (!roles) throw new Error("role catalog unavailable");

  const { data: updated, error: updateError } = await admin
    .from("company_members")
    .update({ status: "active" })
    .eq("id", memberId)
    .eq("user_id", userId)
    .eq("status", "invited")
    .select("company_id, role");
  if (updateError) throw updateError;
  const row = updated?.[0];
  if (!row) return { error: "invite_unavailable" };

  // Committed. The status read above can be stale: re-check, and undo the
  // activation if the company was suspended meanwhile.
  let stillActive = true; // a failed re-check keeps the accept (pre-check passed)
  try {
    stillActive = await isCompanyActive(admin, row.company_id);
  } catch (e) {
    console.warn(`[${scope}] post-accept re-check failed:`, safeErrorFields(e));
  }
  const applied = { row, isAdminRole: isAdminRank(roles, row.role) };
  if (stillActive) return applied;

  // A revert error leaves the row active; a zero-row revert means someone
  // else changed the row first (an admin disabled or removed it), so it may
  // no longer be active. The audit labels the two cases differently.
  let revertFlag: "revert_failed" | "revert_no_row" = "revert_failed";
  try {
    const { data: reverted, error: revertError } = await admin
      .from("company_members")
      .update({ status: "invited" })
      .eq("id", memberId)
      .eq("user_id", userId)
      .eq("status", "active")
      .select("id");
    if (revertError) throw revertError;
    if (reverted && reverted.length > 0) return { error: "invite_unavailable" };
    revertFlag = "revert_no_row";
    console.warn(`[${scope}] revert matched no row`);
  } catch (e) {
    console.warn(`[${scope}] revert failed:`, safeErrorFields(e));
  }
  // The accept committed and was not undone by us: the audit must record it.
  return {
    ...applied,
    auditExtra: { company_inactive_after_accept: true, [revertFlag]: true },
    refuse: "invite_unavailable",
  };
}

/** Decline never needs the company active: an invitee may always walk away. */
async function declineInvite(
  admin: DBClient,
  userId: string,
  memberId: string,
): Promise<Applied> {
  const { data, error } = await admin
    .from("company_members")
    .delete()
    .eq("id", memberId)
    .eq("user_id", userId)
    .eq("status", "invited")
    .select("company_id, role");
  if (error) throw error;
  const row = data?.[0];
  return row ? { row, isAdminRole: false } : { error: "invite_unavailable" };
}

/**
 * Accept or decline the user's own pending invite with the service role.
 *
 * Every write is conditional on the row being the caller's own `invited` row
 * (id + user_id + status) and zero affected rows is reported as
 * `invite_unavailable`, so a concurrent accept, disable or admin delete can
 * never be overwritten and the audited transition is never false.
 */
export async function respondToInvite(
  admin: DBClient,
  userId: string,
  memberId: string,
  response: InviteResponse,
): Promise<InviteResponseResult> {
  const scope = `company-invite-${response}`;
  try {
    const applied =
      response === "accept"
        ? await acceptInvite(admin, userId, memberId, scope)
        : await declineInvite(admin, userId, memberId);
    if ("error" in applied) return { ok: false, error: applied.error };

    await writeAdminAudit(admin, {
      actorUserId: userId,
      action: `company_member.${response}`,
      targetType: "company",
      targetId: applied.row.company_id,
      data: {
        member_id: memberId,
        user_id: userId,
        role: applied.row.role,
        ...applied.auditExtra,
      },
      logScope: scope,
    });
    if (applied.refuse) return { ok: false, error: applied.refuse };
    return {
      ok: true,
      companyId: applied.row.company_id,
      isAdminRole: applied.isAdminRole,
    };
  } catch (e) {
    console.warn(`[${scope}] failed:`, safeErrorFields(e));
    return { ok: false, error: "invite_response_failed" };
  }
}
