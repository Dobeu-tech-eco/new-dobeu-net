import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { NewProjectDialog } from "@/components/admin/NewProjectDialog";

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: actionError } = await searchParams;
  const supabase = createAdminClient();
  const [
    { data: projects, error: projectsError },
    { data: owners, error: ownersError },
    { data: companies, error: companiesError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id,title,status,total_cents,owner_user_id,company_id,started_at,delivered_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    // Full owner list is needed here (not just existing project owners) so
    // NewProjectDialog can assign a brand-new project to any client — bounded
    // to 500 to match the same picker pattern in app/admin/invoices/page.tsx.
    supabase
      .from("profiles")
      .select("id,full_name,company")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("companies")
      .select("id,name")
      .eq("status", "active")
      .order("name"),
  ]);

  const companyIds = [
    ...new Set(
      (projects ?? []).flatMap((project) =>
        project.company_id ? [project.company_id] : [],
      ),
    ),
  ];
  const { data: assignedCompanies, error: assignedCompaniesError } =
    companyIds.length
      ? await supabase.from("companies").select("id,name").in("id", companyIds)
      : { data: [], error: null };
  const companyNames = new Map(
    (assignedCompanies ?? []).map((company) => [company.id, company.name]),
  );

  const ownerOptions = (owners ?? []).map((o) => ({
    id: o.id,
    label: o.full_name?.trim() || o.company?.trim() || o.id.slice(0, 8),
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Projects
          </h1>
          <p className="text-muted-foreground mt-1">
            All client projects across all users.
          </p>
        </div>
        <NewProjectDialog owners={ownerOptions} companies={companies ?? []} />
      </header>

      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {actionError}
        </p>
      )}
      {(projectsError ||
        ownersError ||
        companiesError ||
        assignedCompaniesError) && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          Unable to load all project data. Try again.
        </p>
      )}

      {!projects || projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No projects yet. Click{" "}
          <span className="font-semibold">New project</span> to create the first
          one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Title</th>
                <th className="p-3">Company</th>
                <th className="p-3">Status</th>
                <th className="p-3">Value</th>
                <th className="p-3">Started</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 font-medium">{p.title}</td>
                  <td className="p-3">
                    {p.company_id ? (
                      <Link
                        href={`/admin/companies/${p.company_id}`}
                        className="text-primary hover:underline"
                      >
                        {companyNames.get(p.company_id) ??
                          "Company unavailable"}
                      </Link>
                    ) : (
                      "No company"
                    )}
                  </td>
                  <td className="p-3 uppercase tracking-wider text-xs">
                    {p.status}
                  </td>
                  <td className="p-3">{formatCurrency(p.total_cents)}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {p.started_at
                      ? new Date(p.started_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="p-3 text-right space-x-3">
                    <Link
                      href={`/portal/projects/${p.id}`}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Open
                    </Link>
                    <Link
                      href={`/admin/projects/${p.id}`}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
