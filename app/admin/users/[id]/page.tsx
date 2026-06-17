import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { EditUserForm } from "@/components/admin/EditUserForm";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [profileRes, projectsRes, leadsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,company,apollo_contact_id,created_at,updated_at,avatar_url")
      .eq("id", id)
      .single(),
    supabase
      .from("projects")
      .select("id,title,status,total_cents,started_at,delivered_at")
      .eq("owner_user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id,email,name,source,first_seen,apollo_contact_id")
      .limit(5),
  ]);

  if (profileRes.error || !profileRes.data) notFound();
  const profile = profileRes.data;
  const projects = projectsRes.data ?? [];
  const linkedLeads = (leadsRes.data ?? []).filter(
    (l) =>
      profile.apollo_contact_id &&
      l.apollo_contact_id === profile.apollo_contact_id,
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/users"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All users
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight mt-2">
          {profile.full_name ?? "Unnamed user"}
        </h1>
        <p className="text-muted-foreground text-sm font-mono mt-1">
          {profile.id}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-xl font-semibold">Edit profile</h2>
        <EditUserForm
          user={{ id: profile.id, full_name: profile.full_name, company: profile.company }}
        />
        <p className="text-xs text-muted-foreground">
          Admin access is governed by the <code>ADMIN_EMAILS</code> env var, not this page.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">
          Projects ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No projects.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {projects.map((p) => (
              <li
                key={p.id}
                className="p-4 grid grid-cols-[1fr_auto] gap-3 items-center"
              >
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {p.status}
                  </p>
                </div>
                <p className="text-sm font-medium">
                  {formatCurrency(p.total_cents)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {linkedLeads.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">
            Linked leads (Apollo match)
          </h2>
          <ul className="rounded-lg border border-border divide-y divide-border text-sm">
            {linkedLeads.map((l) => (
              <li key={l.id} className="p-3">
                {l.email} ·{" "}
                <span className="uppercase tracking-wider text-xs">
                  {l.source}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
