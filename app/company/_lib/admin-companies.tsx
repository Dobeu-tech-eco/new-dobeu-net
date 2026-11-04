import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, type DBClient } from "@/lib/actions/auth";
import { COMPANY_PATH_HEADER, companyDeepLink } from "@/lib/company-path";
import { COMPANY_ADMIN_RANK, requireCompanyAdmin } from "@/lib/actions/company-auth";

export interface AdminCompany {
  id: string;
  name: string;
  status: string;
}

/**
 * Companies where the caller is an active admin (rank >= 100), any status.
 * `error` is true when any read failed, so callers that gate access can fail
 * closed instead of treating a read error as "no companies".
 */
export async function resolveAdminCompanies(
  supabase: DBClient,
  userId: string
): Promise<{ companies: AdminCompany[]; error: boolean }> {
  const { data: memberships, error: memberError } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .eq("status", "active");
  if (memberError) return { companies: [], error: true };
  if (!memberships || memberships.length === 0) return { companies: [], error: false };

  const { data: roles, error: rolesError } = await supabase
    .from("company_roles")
    .select("key, rank");
  if (rolesError) return { companies: [], error: true };
  const rankByKey = new Map((roles ?? []).map((r) => [r.key, r.rank]));
  const adminIds = memberships
    .filter((m) => (rankByKey.get(m.role) ?? 0) >= COMPANY_ADMIN_RANK)
    .map((m) => m.company_id);
  if (adminIds.length === 0) return { companies: [], error: false };

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, status")
    .in("id", adminIds);
  if (companiesError || !companies) return { companies: [], error: true };
  return { companies: companies as AdminCompany[], error: false };
}

/** Prefer the requested company; otherwise the first ACTIVE one. */
export function pickCompany(
  companies: AdminCompany[],
  requestedId: string | undefined
): AdminCompany | undefined {
  return (
    companies.find((c) => c.id === requestedId) ??
    companies.find((c) => c.status === "active") ??
    companies[0]
  );
}

export type GuardOutcome = "ok" | "suspended" | "denied";

/** The validated `next` target shared by layout, pages and guards. */
export async function companyNext(fallback: string): Promise<string> {
  return companyDeepLink((await headers()).get(COMPANY_PATH_HEADER), fallback);
}

/**
 * Next renders layout and page in parallel, so a page can never rely on the
 * layout for AAL2 / company status. Every /company page calls this BEFORE any
 * data read. Returns "ok", "suspended" (company status confirmed not active) or
 * "denied" (any other `forbidden`: read error, lost role); render
 * <GuardNotice/> for the latter two and read nothing. MFA and sign-in problems
 * redirect. Unknown errors rethrow (fail closed via the error boundary).
 * redirect() is called outside the try/catch so NEXT_REDIRECT is never
 * swallowed.
 */
export async function guardCompanyPage(
  company: AdminCompany,
  path: string
): Promise<GuardOutcome> {
  // Same validated source as the layout, so whichever redirect wins carries the
  // identical deep link; falls back to this page's own path + company.
  const here = await companyNext(`${path}?company=${encodeURIComponent(company.id)}`);
  let outcome: GuardOutcome | "mfa_required" | "not_authenticated" = "ok";
  try {
    await requireCompanyAdmin(company.id);
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    outcome =
      e.code === "mfa_required"
        ? "mfa_required"
        : e.code === "not_authenticated"
          ? "not_authenticated"
          : company.status !== "active"
            ? "suspended"
            : "denied";
  }
  if (outcome === "mfa_required") {
    redirect(`/portal/settings/mfa?next=${encodeURIComponent(here)}`);
  }
  if (outcome === "not_authenticated") {
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }
  return outcome;
}

/** Fail-closed notice: carries no company data, names the remedy. */
export function SuspendedNotice() {
  return (
    <div role="alert" className="rounded-xl border border-dashed border-border p-10 text-center">
      <p className="font-semibold">
        This company is suspended. Contact Dobeu to reactivate it.
      </p>
      <PortalLink />
    </div>
  );
}

/** Neutral fail-closed notice for a forbidden result that is not a confirmed suspension. */
export function AccessDeniedNotice() {
  return (
    <div role="alert" className="rounded-xl border border-dashed border-border p-10 text-center">
      <p className="font-semibold">
        You don&apos;t have access to this company right now. Go back to the portal or contact
        Dobeu.
      </p>
      <PortalLink />
    </div>
  );
}

export function GuardNotice({ outcome }: { outcome: Exclude<GuardOutcome, "ok"> }) {
  return outcome === "suspended" ? <SuspendedNotice /> : <AccessDeniedNotice />;
}

function PortalLink() {
  return (
    <p className="text-sm mt-1">
      <Link href="/portal" className="text-primary hover:underline">
        Return to your portal
      </Link>
    </p>
  );
}
