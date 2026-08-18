import { createClient } from "@/lib/supabase/server";
import { FolderKanban, Receipt, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function PortalDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [projectsRes, invoicesRes] = await Promise.all([
    supabase.from("projects").select("id,title,status").limit(5),
    supabase
      .from("invoices")
      .select("id,project_id,amount_cents,currency,status,due_date")
      .in("status", ["open", "overdue"])
      .limit(5),
  ]);

  const projects = projectsRes.data ?? [];
  const openInvoices = invoicesRes.data ?? [];
  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {firstName ? `Hi, ${firstName}.` : "Welcome back."}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Here&apos;s what&apos;s open.
        </p>
      </header>

      {/* Stat tiles */}
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
          highlight={openInvoices.length > 0}
        />
      </div>

      {/* Recent projects */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Recent projects</h2>
          <Link
            href="/portal/projects"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
        {projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            body="When we start working together, projects show up here with files and invoices."
          />
        ) : (
          <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {projects.map((p) => (
              <li
                key={p.id}
                className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{p.title}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mt-0.5">
                    {p.status}
                  </p>
                </div>
                <Link
                  href={`/portal/projects/${p.id}`}
                  className="shrink-0 text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  Open
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
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
  label,
  highlight = false,
}: {
  href: string;
  icon: React.ReactNode;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-xl border bg-card p-5 flex flex-col gap-3 transition-all hover:border-primary/40 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.12)] " +
        (highlight
          ? "border-accent/40 bg-accent/5"
          : "border-border")
      }
    >
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="font-display text-3xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  );
}
