import Link from "next/link";
import { Users, FolderKanban, Ticket, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  guardCompanyPage,
  pickCompany,
  resolveAdminCompanies,
  SuspendedNotice,
  type AdminCompany
} from "./_lib/admin-companies";

export const dynamic = "force-dynamic";

export default async function CompanyOverviewPage({
  searchParams
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const companies = await resolveAdminCompanies(supabase, user?.id ?? "");
  const selected = pickCompany(companies, sp.company);

  // Defensive: the layout gates access, but if resolution turns up empty, render
  // an empty state rather than throwing.
  if (!selected) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="font-semibold">No company found</p>
        <p className="text-sm text-muted-foreground mt-1">
          You are not an admin of any company yet.
        </p>
      </div>
    );
  }

  const companyId = selected.id;
  // Layout and page render in parallel: re-check active company + AAL2 here,
  // before any count read.
  if ((await guardCompanyPage(companyId, "/company")) === "suspended") {
    return <SuspendedNotice />;
  }

  const [membersRes, projectsRes, workOrdersRes, entitlementsRes] = await Promise.all([
    supabase.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase
      .from("asset_entitlements")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{selected.name}</h1>
          <p className="text-muted-foreground mt-1">
            Company workspace ·{" "}
            <span className="uppercase tracking-wider text-xs">{selected.status}</span>
          </p>
        </div>
        {companies.length > 1 && <CompanySwitcher companies={companies} selectedId={companyId} />}
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={<Users className="h-5 w-5" />} value={membersRes.count ?? 0} label="Members" />
        <StatTile
          icon={<FolderKanban className="h-5 w-5" />}
          value={projectsRes.count ?? 0}
          label="Projects"
        />
        <StatTile
          icon={<Ticket className="h-5 w-5" />}
          value={workOrdersRes.count ?? 0}
          label="Work orders"
        />
        <StatTile
          icon={<Package className="h-5 w-5 text-accent" />}
          value={entitlementsRes.count ?? 0}
          label="Entitled assets"
        />
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">Manage</h2>
        <ul className="rounded-lg border border-border divide-y divide-border">
          <li className="p-4 flex items-center justify-between hover:bg-muted/40">
            <div>
              <p className="font-medium">Members</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Invite people, change roles, and disable access.
              </p>
            </div>
            <Link
              href={`/company/members?company=${companyId}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open →
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

function CompanySwitcher({
  companies,
  selectedId
}: {
  companies: AdminCompany[];
  selectedId: string;
}) {
  return (
    <nav aria-label="Switch company" className="flex flex-wrap gap-2">
      {companies.map((c) => (
        <Link
          key={c.id}
          href={`/company?company=${c.id}`}
          aria-current={c.id === selectedId ? "true" : undefined}
          className={
            c.id === selectedId
              ? "rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
              : "rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}

function StatTile({
  icon,
  value,
  label
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3 text-muted-foreground">{icon}</div>
      <p className="font-display text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
