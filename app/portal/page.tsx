import { createClient } from "@/lib/supabase/server";
import { FolderKanban, Receipt } from "lucide-react";
import Link from "next/link";

export default async function PortalDashboard() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Fetch dashboard data — RLS auto-scopes to this user.
  // (Messages tile dropped in Phase 1 — Intercom owns chat now;
  // tickets/work-orders tile will land in Phase 3.)
  const [projectsRes, invoicesRes] = await Promise.all([
    supabase.from("projects").select("id,title,status").limit(5),
    supabase
      .from("invoices")
      .select("id,project_id,amount_cents,currency,status,due_date")
      .in("status", ["open", "overdue"])
      .limit(5)
  ]);

  const projects = projectsRes.data ?? [];
  const openInvoices = invoicesRes.data ?? [];
  void user;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}.
        </h1>
        <p className="text-muted-foreground mt-1">Here&apos;s what&apos;s open.</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <DashboardTile
          href="/portal/projects"
          icon={<FolderKanban className="h-5 w-5" />}
          value={projects.filter((p) => p.status === "active").length}
          label="Active projects"
        />
        <DashboardTile
          href="/portal/invoices"
          icon={<Receipt className="h-5 w-5 text-accent" />}
          value={openInvoices.length}
          label="Open invoices"
        />
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">Recent projects</h2>
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            body="When we start working together, projects show up here with files and invoices."
          />
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {projects.map((p) => (
              <li key={p.id} className="p-4 flex items-center justify-between hover:bg-muted/40">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mt-0.5">
                    {p.status}
                  </p>
                </div>
                <Link
                  href={`/portal/projects/${p.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DashboardTile({
  href,
  icon,
  value,
  label
}: {
  href: string;
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-5 hover:shadow-glow hover:border-primary/40 transition-all"
    >
      <div className="flex items-center justify-between mb-3 text-muted-foreground">
        {icon}
      </div>
      <p className="font-display text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{body}</p>
    </div>
  );
}
