/**
 * Company-scoped auth guards (multi-tenant layer).
 *
 * Pattern mirrors `auth.ts`: guards throw `AuthError` and return the
 * cookie-bound client so RLS stays the enforcement layer for member reads.
 * Role privilege is rank-based via the extensible `company_roles` catalog
 * (higher rank = more privilege; company_admin = 100), so new employer/role
 * types added as rows work without code changes.
 *
 * Server-only by transitive import of `@/lib/supabase/server` via `./auth`.
 */
import type { User } from "@supabase/supabase-js";
import { AuthError, requireUser, type DBClient } from "./auth";

/** Rank of the company_admin role seeded in the tenancy migration. */
export const COMPANY_ADMIN_RANK = 100;

export interface CompanyMembership {
  companyId: string;
  role: string;
  rank: number;
}

export interface CompanyGuardResult {
  user: User;
  supabase: DBClient;
  membership: CompanyMembership;
}

/**
 * Require the caller to be an ACTIVE member of `companyId` with role rank
 * >= `minRank`. Throws `AuthError("forbidden")` for non-members, inactive
 * memberships, and insufficient rank.
 */
export async function requireCompanyMember(
  companyId: string,
  minRank = 0
): Promise<CompanyGuardResult> {
  const { user, supabase } = await requireUser();

  const { data: member, error } = await supabase
    .from("company_members")
    .select("role, status")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (error || !member) {
    throw new AuthError("forbidden");
  }

  const { data: role } = await supabase
    .from("company_roles")
    .select("rank")
    .eq("key", member.role)
    .single();

  const rank = role?.rank ?? 0;
  if (rank < minRank) {
    throw new AuthError("forbidden");
  }

  return {
    user,
    supabase,
    membership: { companyId, role: member.role, rank }
  };
}

/** Require the caller to be the company's admin (rank >= 100). */
export async function requireCompanyAdmin(
  companyId: string
): Promise<CompanyGuardResult> {
  return requireCompanyMember(companyId, COMPANY_ADMIN_RANK);
}
