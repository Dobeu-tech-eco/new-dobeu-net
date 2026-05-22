import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [projectRes, filesRes, invoicesRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("project_files").select("*").eq("project_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("project_id", id).order("created_at", { ascending: false })
  ]);

  if (projectRes.error || !projectRes.data) notFound();
  const project = projectRes.data;
  const files = filesRes.data ?? [];
  const invoices = invoicesRes.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/portal/projects" className="text-xs text-muted-foreground hover:text-foreground">
          ← All projects
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight mt-2">{project.title}</h1>
        {project.description && <p className="text-muted-foreground mt-1">{project.description}</p>}
        <p className="text-xs uppercase tracking-wider text-muted-foreground mt-2">{project.status}</p>
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">Files ({files.length})</h2>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files attached yet.</p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {files.map((f) => (
              <li key={f.id} className="p-3 flex justify-between items-center text-sm">
                <span>{f.filename}</span>
                <form action={`/api/files/${f.id}/download`} method="post">
                  <button type="submit" className="text-primary hover:underline font-medium">
                    Download →
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">Invoices ({invoices.length})</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices for this project yet.</p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {invoices.map((inv) => (
              <li key={inv.id} className="p-3 flex justify-between items-center text-sm">
                <span>{formatCurrency(inv.amount_cents, inv.currency)}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{inv.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
