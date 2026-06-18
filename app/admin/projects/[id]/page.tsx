import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { EditProjectForm } from "@/components/admin/EditProjectForm";
import { DeleteProjectButton } from "@/components/admin/DeleteProjectButton";

export default async function AdminProjectDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id,title,description,status,total_cents,owner_user_id,started_at,delivered_at,created_at,updated_at"
    )
    .eq("id", id)
    .single();

  if (error || !project) notFound();

  const ownerProfile = await supabase
    .from("profiles")
    .select("id,full_name,company")
    .eq("id", project.owner_user_id)
    .single();

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/projects" className="text-xs text-muted-foreground hover:text-foreground">
          ← All projects
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight mt-2">{project.title}</h1>
        <p className="text-muted-foreground mt-1">
          Owned by{" "}
          <span className="font-medium text-foreground">
            {ownerProfile.data?.full_name ?? ownerProfile.data?.company ?? project.owner_user_id.slice(0, 8)}
          </span>
          {" · "}value {formatCurrency(project.total_cents)}
          {" · "}status <span className="uppercase tracking-wider text-xs">{project.status}</span>
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold mb-4">Edit project</h2>
        <EditProjectForm
          project={{
            id: project.id,
            title: project.title,
            description: project.description,
            status: project.status,
            total_cents: project.total_cents
          }}
        />
      </section>

      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-display text-xl font-semibold text-destructive mb-2">Danger zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Deleting a project cascades to its files and invoices. Storage objects must be reaped
          separately.
        </p>
        <DeleteProjectButton id={project.id} title={project.title} />
      </section>
    </div>
  );
}
