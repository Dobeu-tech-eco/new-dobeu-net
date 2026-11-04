import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, type DBClient } from "@/lib/actions/auth";
import { COMPANY_ADMIN_RANK, requireCompanyAdmin } from "@/lib/actions/company-auth";

export interface AdminCompany {
  id: string;
  name: string;
  status: string;
}

/** Companies where the caller is an active admin (rank >= 100), any status. */
export async function resolveAdminCompanies(
  supabase: DBClient,
  userId: string
): Promise<AdminCompany[]> {
  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .eq("status", "active");
  if (!memberships || memberships.length === 0) return [];

  const { data: roles } = await supabase.from("company_roles").select("key, rank");
  const rankByKey = new Map((roles ?? []).map((r) => [r.key, r.rank]));
  const adminIds = memberships
    .filter((m) => (rankByKey.get(m.role) ?? 0) >= COMPANY_ADMIN_RANK)
    .map((m) => m.company_id);
  if (adminIds.length === 0) return [];

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, status")
    .in("id", adminIds);
  return (companies ?? []) as AdminCompany[];
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

/**
 * Next renders layout and page in parallel, so a page can never rely on the
 * layout for AAL2 / company status. Every /company page calls this BEFORE any
 * data read. Returns "ok" or "suspended" (render <SuspendedNotice/>, read
 * nothing); MFA and sign-in problems redirect. Unknown errors rethrow (fail
 * closed via the error boundary). redirect() is called outside the try/catch
 * so NEXT_REDIRECT is never swallowed.
 */
export async function guardCompanyPage(
  companyId: string,
  path: string
): Promise<"ok" | "suspended"> {
  const here = `${path}?company=${encodeURIComponent(companyId)}`;
  let outcome: "ok" | "suspended" | "mfa_required" | "not_authenticated" = "ok";
  try {
    await requireCompanyAdmin(companyId);
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    outcome =
      e.code === "mfa_required"
        ? "mfa_required"
        : e.code === "not_authenticated"
          ? "not_authenticated"
          : "suspended";
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
      <p className="font-semibold">This company is suspended</p>
      <p className="text-sm text-muted-foreground mt-1">
        Contact Dobeu to reactivate it, or{" "}
        <Link href="/portal" className="text-primary hover:underline">
          return to your portal
        </Link>
        .
      </p>
    </div>
  );
}
