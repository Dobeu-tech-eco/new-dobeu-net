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
import {
  requiresAal2Stepup,
  requiresMfaEnrollment,
  type AssuranceLevel
} from "@/lib/utils";
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

/**
 * Fail-closed AAL check for company admins: true when the session must enroll
 * in or step up to MFA. A lookup error or throw is indeterminate and counts as
 * "needs step-up".
 */
export async function needsAal2StepUp(supabase: DBClient): Promise<boolean> {
  let assurance: AssuranceLevel = null;
  try {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    assurance = error ? null : data ?? null;
  } catch {
    assurance = null;
  }
  // `true` = this role must reach AAL2 (not an ADMIN_EMAILS check).
  return requiresMfaEnrollment(assurance, true) || requiresAal2Stepup(assurance);
}

/**
 * Require the caller to be the company's admin (rank >= 100) of an ACTIVE
 * company whose session has reached AAL2. Fails closed, in this order, so a
 * non-admin always gets "forbidden" and never learns MFA state:
 *   1. membership + rank (`requireCompanyMember`) -> "forbidden"
 *   2. companies.status === 'active' (read error / missing row / suspended)
 *      -> "forbidden"
 *   3. AAL2 -> "mfa_required"
 */
export async function requireCompanyAdmin(
  companyId: string
): Promise<CompanyGuardResult> {
  const result = await requireCompanyMember(companyId, COMPANY_ADMIN_RANK);
  const { supabase } = result;

  // A thrown read fails closed too (not just a returned `{ error }`).
  let companyActive = false;
  try {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("status")
      .eq("id", companyId)
      .single();
    companyActive = !companyError && company?.status === "active";
  } catch {
    companyActive = false;
  }
  if (!companyActive) {
    throw new AuthError("forbidden");
  }

  if (await needsAal2StepUp(supabase)) {
    throw new AuthError("mfa_required");
  }

  return result;
}
