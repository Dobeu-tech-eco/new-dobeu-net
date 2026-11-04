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
          isAdminRole: (info?.rank ?? 0) >= COMPANY_ADMIN_RANK,
        },
      ];
    });
    return { invites, error: false };
  } catch (e) {
    console.warn("[listPendingInvites] read failed:", safeErrorFields(e));
    return failed;
  }
}

/**
 * Accept or decline the user's own pending invite with the service role.
 *
 * Every write is conditional on the row being the caller's own `invited` row
 * (id + user_id + status) and zero affected rows is reported as
 * `invite_unavailable`, so a concurrent accept, disable or admin delete can
 * never be overwritten and the audited transition is never false.
 *
 * Accept additionally needs the company to be ACTIVE. Decline deliberately
 * does NOT: an invitee may always walk away from a suspended company.
 */
export async function respondToInvite(
  admin: DBClient,
  userId: string,
  memberId: string,
  response: InviteResponse,
): Promise<InviteResponseResult> {
  const scope = `company-invite-${response}`;
  try {
    let row: { company_id: string; role: string } | undefined;
    let isAdminRole = false;

    if (response === "accept") {
      const { data: current, error } = await admin.from("company_members")
        .select("company_id, role")
        .eq("id", memberId)
        .eq("user_id", userId)
        .eq("status", "invited")
        .maybeSingle();
      if (error) throw error;
      if (!current) return { ok: false, error: "invite_unavailable" };

      const { data: company, error: companyError } = await admin
        .from("companies")
        .select("status")
        .eq("id", current.company_id)
        .maybeSingle();
      if (companyError) throw companyError;
      if (company?.status !== "active") {
        return { ok: false, error: "invite_unavailable" };
      }

      // Resolve the rank before writing so a catalog read failure cannot
      // leave an accepted invite that reports an error.
      const roles = await loadRoles(admin);
      if (!roles) throw new Error("role catalog unavailable");
      isAdminRole = (roles.get(current.role)?.rank ?? 0) >= COMPANY_ADMIN_RANK;

      const { data: updated, error: updateError } = await admin.from("company_members")
        .update({ status: "active" })
        .eq("id", memberId)
        .eq("user_id", userId)
        .eq("status", "invited")
        .select("company_id, role");
      if (updateError) throw updateError;
      row = updated?.[0];
    } else {
      const { data: deleted, error } = await admin.from("company_members")
        .delete()
        .eq("id", memberId)
        .eq("user_id", userId)
        .eq("status", "invited")
        .select("company_id, role");
      if (error) throw error;
      row = deleted?.[0];
    }

    if (!row) return { ok: false, error: "invite_unavailable" };

    await writeAdminAudit(admin, {
      actorUserId: userId,
      action: `company_member.${response}`,
      targetType: "company",
      targetId: row.company_id,
      data: { member_id: memberId, user_id: userId, role: row.role },
      logScope: scope,
    });
    return { ok: true, companyId: row.company_id, isAdminRole };
  } catch (e) {
    console.warn(`[${scope}] failed:`, safeErrorFields(e));
    return { ok: false, error: "invite_response_failed" };
  }
}
