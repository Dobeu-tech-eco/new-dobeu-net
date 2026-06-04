import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { NewProjectDialog } from "@/components/admin/NewProjectDialog";

export default async function AdminProjectsPage() {
  const supabase = createAdminClient();
  const [{ data: projects }, { data: owners }] = await Promise.all([
    supabase
      .from("projects")
      .select("id,title,status,total_cents,owner_user_id,started_at,delivered_at,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id,full_name,company")
      .order("created_at", { ascending: false })
  ]);

  const ownerOptions = (owners ?? []).map((o) => ({
    id: o.id,
    label: o.full_name?.trim() || o.company?.trim() || o.id.slice(0, 8)
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">All client projects across all users.</p>
        </div>
        <NewProjectDialog owners={ownerOptions} />
      </header>

      {!projects || projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No projects yet. Click <span className="font-semibold">New project</span> to create the first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Title</th>
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
                  <td className="p-3 uppercase tracking-wider text-xs">{p.status}</td>
                  <td className="p-3">{formatCurrency(p.total_cents)}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {p.started_at ? new Date(p.started_at).toLocaleDateString() : "—"}
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
