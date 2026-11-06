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
import {
  emailChangeQuiet,
  latestLinkTimestamp,
  toSeconds,
  type ProofIdentity,
  type SessionMethod,
} from "@/lib/mailbox-proof";
import { createAdminClient } from "@/lib/supabase/server";

export type InviteFailure =
  | "invite_unavailable"
  | "invite_response_failed"
  | "invite_email_unconfirmed"
  | "invite_signin_stale"
  | "invite_email_changed"
  | "invite_company_inactive"
  | "invite_already_accepted";

export type InviteResponse = "accept" | "decline";

export type InviteResponseResult =
  | {
      ok: true;
      companyId: string;
      isAdminRole: boolean;
      /** Accepted, but the company was suspended meanwhile and the undo failed. */
      companyInactive?: boolean;
    }
  | { ok: false; error: InviteFailure };

export type PendingInvite = {
  memberId: string;
  companyId: string;
  companyName: string;
  role: string;
  roleLabel: string;
  isAdminRole: boolean;
  /** False for a suspended company: the invite can be declined, not accepted. */
  companyActive: boolean;
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

export type { SessionMethod, ProofIdentity };

export type MailboxProofFailure =
  | "invite_email_unconfirmed"
  | "invite_signin_stale"
  | "invite_email_changed";

/**
 * `email_confirmed_at` alone is not mailbox proof (signups may auto-confirm,
 * so a squatter can register a victim's address). Pure check, all in whole
 * seconds, failing closed. In order:
 *  1. the session needs an email-link entry WITH a timestamp (the newest
 *     wins), else `invite_email_unconfirmed`;
 *  2. that link sign-in must not predate the invite, else
 *     `invite_signin_stale`;
 *  3. accept only: `emailChangeQuiet` (no email change requested within
 *     EMAIL_CHANGE_WINDOW_SECONDS before the link sign-in, the email identity
 *     not updated since and not changed inside that window), else
 *     `invite_email_changed`. A code's sign-in time is the exchange time, not
 *     the send time, so send-time ordering cannot work; the identity signal
 *     survives a password change, which clears `email_change_sent_at`;
 *  4. accept only: no email change may have been REQUESTED since the invite
 *     was created (`emailChangeSentAt` >= the invite's second), else
 *     `invite_email_changed`.
 * Decline stops after step 2: deleting the caller's own invited row grants
 * nothing, and skipping the email-change rules keeps an invitee who changed
 * their email from being stuck with an invite they can neither answer nor
 * clear. Returns null when proven.
 */
export function checkMailboxProof(input: {
  methods: SessionMethod[];
  identities: ProofIdentity[] | null | undefined;
  inviteCreatedAt: string;
  /** The user's `email_change_sent_at` (when an email change was requested). */
  emailChangeSentAt?: string | null;
  /** Defaults to "accept" (the strict rules). */
  response?: InviteResponse;
}): null | MailboxProofFailure {
  const linkTs = latestLinkTimestamp(input.methods);
  if (linkTs === null) return "invite_email_unconfirmed";

  const invitedAt = toSeconds(input.inviteCreatedAt);
  if (invitedAt === null || invitedAt > linkTs) return "invite_signin_stale";

  if (input.response === "decline") return null;

  if (
    !emailChangeQuiet({
      emailChangeSentAt: input.emailChangeSentAt,
      identities: input.identities,
      linkTs,
    })
  ) {
    return "invite_email_changed";
  }

  if (input.emailChangeSentAt) {
    const requestedAt = toSeconds(input.emailChangeSentAt);
    if (requestedAt === null || requestedAt >= invitedAt) return "invite_email_changed";
  }
  return null;
}

/** The session's authentication methods, or null when the lookup fails. */
export async function loadSessionMethods(
  supabase: DBClient,
): Promise<SessionMethod[] | null> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;
  return data.currentAuthenticationMethods as SessionMethod[];
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


/**
 * The invitee's pending invites, including those of suspended companies
 * (`companyActive: false`: decline only). Read errors fail soft.
 */
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
      .select("id, name, status")
      .in("id", [...new Set(rows.map((r) => r.company_id))]);
    if (companiesError || !companies) return failed;
    const roles = await loadRoles(admin);
    if (!roles) return failed;

    const companyById = new Map(companies.map((c) => [c.id, c]));
    const invites = rows.flatMap((r) => {
      const company = companyById.get(r.company_id);
      if (company === undefined) return [];
      const info = roles.get(r.role);
      return [
        {
          memberId: r.id,
          companyId: r.company_id,
          companyName: company.name,
          role: r.role,
          roleLabel: info?.label ?? r.role,
          isAdminRole: isAdminRank(roles, r.role),
          companyActive: company.status === "active",
        },
      ];
    });
    return { invites, error: false };
  } catch (e) {
    console.warn("[listPendingInvites] read failed:", safeErrorFields(e));
    return failed;
  }
}

export type SessionProof = {
  methods: SessionMethod[];
  identities: ProofIdentity[] | null | undefined;
  emailChangeSentAt?: string | null;
};

type MemberRow = { company_id: string; role: string };
type OwnRow = MemberRow & { created_at: string; status: string };

/**
 * What a flow decided: the result to return, plus the audit row to write when
 * a state change committed (none for refusals and double-click no-ops).
 */
type Outcome = {
  result: InviteResponseResult;
  audit?: {
    action: "accept" | "decline" | "accept_reverted";
    row: MemberRow;
    extra?: Record<string, boolean>;
  };
};

const fail = (error: InviteFailure): Outcome => ({
  result: { ok: false, error },
});

/** The caller's own membership row, in any status. */
async function readOwnRow(
  admin: DBClient,
  userId: string,
  memberId: string,
): Promise<OwnRow | null> {
  const { data, error } = await admin
    .from("company_members")
    .select("company_id, role, created_at, status")
    .eq("id", memberId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Re-read after a zero-row write: is the row now active for this user? */
async function readActiveRow(
  admin: DBClient,
  userId: string,
  memberId: string,
): Promise<MemberRow | null> {
  const { data, error } = await admin
    .from("company_members")
    .select("company_id, role, status")
    .eq("id", memberId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data && data.status === "active" ? data : null;
}

/**
 * Accept: read own row, check the session proof and an ACTIVE company, then
 * activate. Throws only BEFORE the update commits; everything after is handled
 * inline so the row and the audit log can never disagree with the result.
 */
async function acceptInvite(
  admin: DBClient,
  userId: string,
  memberId: string,
  proof: SessionProof,
  scope: string,
): Promise<Outcome> {
  const current = await readOwnRow(admin, userId, memberId);
  if (!current) return fail("invite_unavailable");

  // Resolve the catalog before writing so a read failure cannot leave an
  // accepted invite that reports an error.
  const roles = await loadRoles(admin);
  if (!roles) throw new Error("role catalog unavailable");

  // Double click: already active is a success, with no write and no audit.
  if (current.status === "active") {
    // Same company check as the zero-row loser: the winner may be reverting.
    let companyActive = true;
    try {
      companyActive = await isCompanyActive(admin, current.company_id);
    } catch (e) {
      console.warn(`[${scope}] already-active company check failed:`, safeErrorFields(e));
    }
    return {
      result: {
        ok: true,
        companyId: current.company_id,
        isAdminRole: isAdminRank(roles, current.role),
        ...(companyActive ? {} : { companyInactive: true }),
      },
    };
  }
  if (current.status !== "invited") return fail("invite_unavailable");

  const proofError = checkMailboxProof({
    methods: proof.methods,
    identities: proof.identities,
    emailChangeSentAt: proof.emailChangeSentAt,
    inviteCreatedAt: current.created_at,
    response: "accept",
  });
  if (proofError) return fail(proofError);

  if (!(await isCompanyActive(admin, current.company_id))) {
    return fail("invite_company_inactive");
  }

  const { data: updated, error: updateError } = await admin
    .from("company_members")
    .update({ status: "active" })
    .eq("id", memberId)
    .eq("user_id", userId)
    .eq("status", "invited")
    .select("company_id, role");
  if (updateError) throw updateError;
  const row = updated?.[0];
  if (!row) {
    // Lost a race. If the winner activated this same row, report success,
    // flagged when the company was suspended meanwhile (the winner may be
    // reverting it).
    const active = await readActiveRow(admin, userId, memberId);
    if (!active) return fail("invite_unavailable");
    let companyActive = true;
    try {
      companyActive = await isCompanyActive(admin, active.company_id);
    } catch (e) {
      console.warn(`[${scope}] double-submit company check failed:`, safeErrorFields(e));
    }
    return {
      result: {
        ok: true,
        companyId: active.company_id,
        isAdminRole: isAdminRank(roles, active.role),
        ...(companyActive ? {} : { companyInactive: true }),
      },
    };
  }

  // Committed. The status read above can be stale: re-check, and undo the
  // activation if the company was suspended meanwhile.
  let stillActive = true; // a failed re-check keeps the accept (pre-check passed)
  try {
    stillActive = await isCompanyActive(admin, row.company_id);
  } catch (e) {
    console.warn(`[${scope}] post-accept re-check failed:`, safeErrorFields(e));
  }
  const isAdminRole = isAdminRank(roles, row.role);
  const accepted: Outcome = {
    result: { ok: true, companyId: row.company_id, isAdminRole },
    audit: { action: "accept", row },
  };
  if (stillActive) return accepted;

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
    if (reverted && reverted.length > 0) {
      return {
        result: { ok: false, error: "invite_company_inactive" },
        audit: { action: "accept_reverted", row },
      };
    }
    revertFlag = "revert_no_row";
    console.warn(`[${scope}] revert matched no row`);
  } catch (e) {
    console.warn(`[${scope}] revert failed:`, safeErrorFields(e));
  }

  // The accept committed and was not undone by us: the audit must record it.
  // Only a re-read that PROVES the row is no longer active reports the invite
  // as unavailable; a failed re-read keeps the committed accept.
  let active: MemberRow | null = null;
  let rereadFailed = false;
  try {
    active = await readActiveRow(admin, userId, memberId);
  } catch (e) {
    rereadFailed = true;
    console.warn(`[${scope}] post-revert re-read failed:`, safeErrorFields(e));
  }
  const extra: Record<string, boolean> = {
    company_inactive_after_accept: true,
    [revertFlag]: true,
    ...(rereadFailed ? { reread_failed: true } : {}),
  };
  if (active || rereadFailed) {
    return {
      result: { ok: true, companyId: row.company_id, isAdminRole, companyInactive: true },
      audit: { action: "accept", row, extra },
    };
  }
  return {
    result: { ok: false, error: "invite_unavailable" },
    audit: { action: "accept", row, extra },
  };
}

/** Decline never needs the company active: an invitee may always walk away. */
async function declineInvite(
  admin: DBClient,
  userId: string,
  memberId: string,
  proof: SessionProof,
): Promise<Outcome> {
  const current = await readOwnRow(admin, userId, memberId);
  if (!current) return fail("invite_unavailable");
  if (current.status === "active") return fail("invite_already_accepted");
  if (current.status !== "invited") return fail("invite_unavailable");

  const proofError = checkMailboxProof({
    methods: proof.methods,
    identities: proof.identities,
    emailChangeSentAt: proof.emailChangeSentAt,
    inviteCreatedAt: current.created_at,
    response: "decline",
  });
  if (proofError) return fail(proofError);

  const { data, error } = await admin
    .from("company_members")
    .delete()
    .eq("id", memberId)
    .eq("user_id", userId)
    .eq("status", "invited")
    .select("company_id, role");
  if (error) throw error;
  const row = data?.[0];
  if (row) {
    return {
      result: { ok: true, companyId: row.company_id, isAdminRole: false },
      audit: { action: "decline", row },
    };
  }
  const active = await readActiveRow(admin, userId, memberId);
  return fail(active ? "invite_already_accepted" : "invite_unavailable");
}

/**
 * Accept or decline the user's own pending invite with the service role.
 *
 * Every write is conditional on the row being the caller's own `invited` row
 * (id + user_id + status); a zero-row write is re-read so a double click is
 * told apart from a withdrawn invite, and a concurrent accept, disable or
 * admin delete is never overwritten and the audited transition is never false.
 * `proof` is the session's sign-in methods and identities, checked against the
 * invite's creation time (see `checkMailboxProof`).
 */
export async function respondToInvite(
  admin: DBClient,
  userId: string,
  memberId: string,
  response: InviteResponse,
  proof: SessionProof,
): Promise<InviteResponseResult> {
  const scope = `company-invite-${response}`;
  try {
    const outcome =
      response === "accept"
        ? await acceptInvite(admin, userId, memberId, proof, scope)
        : await declineInvite(admin, userId, memberId, proof);

    if (outcome.audit) {
      const { action, row, extra } = outcome.audit;
      await writeAdminAudit(admin, {
        actorUserId: userId,
        action: `company_member.${action}`,
        targetType: "company",
        targetId: row.company_id,
        data: { member_id: memberId, user_id: userId, role: row.role, ...extra },
        logScope: scope,
      });
    }
    return outcome.result;
  } catch (e) {
    console.warn(`[${scope}] failed:`, safeErrorFields(e));
    return { ok: false, error: "invite_response_failed" };
  }
}
