import Link from "next/link";
import { redirect } from "next/navigation";

// The /company surface is entirely per-request auth/membership-driven, so it
// must never be statically pre-rendered.
export const dynamic = "force-dynamic";

import { LayoutDashboard, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/portal/LogoutButton";
import { COMPANY_ADMIN_RANK } from "@/lib/actions/company-auth";
import { SuspendedNotice } from "./_lib/admin-companies";
import { requiresAal2Stepup, requiresMfaEnrollment, type AssuranceLevel } from "@/lib/utils";

const NAV = [
  { href: "/company", label: "Overview", icon: LayoutDashboard },
  { href: "/company/members", label: "Members", icon: Users }
];

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Backstop only: middleware is the authoritative redirect (it preserves the
  // full path + query in `next`).
  if (!user) {
    redirect("/login?next=/company");
  }

  // Gate: the caller must be a company_admin (rank >= 100) of at least one
  // company. RLS already limits which member rows they can read; we additionally
  // resolve the role rank from the extensible catalog so new admin-tier roles
  // work without touching this gate.
  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  let adminCompanyIds: string[] = [];
  if (memberships && memberships.length > 0) {
    const { data: roles } = await supabase.from("company_roles").select("key, rank");
    const rankByKey = new Map((roles ?? []).map((r) => [r.key, r.rank]));
    adminCompanyIds = memberships
      .filter((m) => (rankByKey.get(m.role) ?? 0) >= COMPANY_ADMIN_RANK)
      .map((m) => m.company_id);
  }

  if (adminCompanyIds.length === 0) {
    redirect("/portal");
  }

  // The shell is only for admins of at least one ACTIVE company. A read error
  // fails closed. Checked before any AAL lookup so a suspended-only admin
  // learns nothing about MFA state. (Pages re-check per company themselves:
  // layout and page render in parallel.)
  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, status")
    .in("id", adminCompanyIds);
  if (companiesError || !companies) {
    redirect("/portal");
  }
  if (!companies.some((c) => c.status === "active")) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 md:p-8">
        <SuspendedNotice />
      </main>
    );
  }

  // MFA is mandatory for company admins too. Fail CLOSED: an assurance lookup
  // error or throw is treated as indeterminate (null). Only the lookup is wrapped
  // so Next's NEXT_REDIRECT throw from redirect() is never swallowed.
  let assurance: AssuranceLevel = null;
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    assurance = error ? null : (data ?? null);
  } catch {
    assurance = null;
  }
  if (requiresMfaEnrollment(assurance, true) || requiresAal2Stepup(assurance)) {
    redirect("/portal/settings/mfa?next=/company");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-card/40">
        <div className="p-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <DobeuMark className="h-8 w-8" />
            <span className="font-display text-lg font-bold lowercase">dobeu</span>
          </Link>
          <ThemeToggle />
        </div>
        <nav aria-label="Company admin" className="px-2 pb-2 md:pb-6 flex md:block gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
          <Link
            href="/portal"
            title="Portal"
            aria-label="Portal"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10 transition-colors whitespace-nowrap"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />{" "}
            <span className="hidden sm:inline">Portal</span>
          </Link>
          <LogoutButton />
        </nav>
        <div className="hidden md:block px-4 py-3 mt-auto text-xs text-muted-foreground border-t border-border">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <main className="p-4 md:p-8 max-w-5xl">{children}</main>
      </div>
    </div>
  );
}
