import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export default async function AdminProjectsPage() {
  const supabase = createAdminClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id,title,status,total_cents,owner_user_id,started_at,delivered_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground mt-1">All client projects across all users.</p>
      </header>

      {!projects || projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No projects yet.
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
                <th className="p-3 text-right">Action</th>
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
                  <td className="p-3 text-right">
                    <Link
                      href={`/portal/projects/${p.id}`}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Open →
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
