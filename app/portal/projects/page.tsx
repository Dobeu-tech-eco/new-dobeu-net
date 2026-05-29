import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectsListPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id,title,description,status,started_at,delivered_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Projects
        </h1>
        <p className="text-muted-foreground mt-1">
          All your work in one place.
        </p>
      </header>

      {!projects || projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">No projects yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            New work shows up here once we start an engagement.
          </p>
        </div>
      ) : (
        <ul className="rounded-lg border border-border divide-y divide-border">
          {projects.map((p) => (
            <li
              key={p.id}
              className="p-4 flex items-start justify-between gap-4"
            >
              <div>
                <Link
                  href={`/portal/projects/${p.id}`}
                  className="font-semibold hover:text-primary"
                >
                  {p.title}
                </Link>
                {p.description && (
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    {p.description}
                  </p>
                )}
                <p className="text-xs uppercase tracking-wider text-muted-foreground mt-2">
                  {p.status}
                </p>
              </div>
              <Link
                href={`/portal/projects/${p.id}`}
                className="shrink-0 text-sm font-medium text-primary hover:underline"
              >
                Open →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
