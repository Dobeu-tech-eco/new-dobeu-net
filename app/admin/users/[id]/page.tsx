import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function saveProfile(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const full_name = (String(formData.get("full_name") ?? "").trim() || null) as
    | string
    | null;
  const company = (String(formData.get("company") ?? "").trim() || null) as
    | string
    | null;
  const is_admin = formData.get("is_admin") === "on";

  const supa = createAdminClient();
  await supa
    .from("profiles")
    .update({ full_name, company, is_admin })
    .eq("id", id);
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
}

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
      .select(
        "id,full_name,company,apollo_contact_id,is_admin,created_at,updated_at,avatar_url",
      )
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

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold mb-4">
          Edit profile
        </h2>
        <form action={saveProfile} className="space-y-4 max-w-lg">
          <input type="hidden" name="id" value={profile.id} />
          <div className="grid gap-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile.full_name ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              name="company"
              defaultValue={profile.company ?? ""}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_admin"
              defaultChecked={profile.is_admin}
              className="h-4 w-4 rounded border-border"
            />
            <span>
              Admin{" "}
              <span className="text-muted-foreground">
                (grants /admin access)
              </span>
            </span>
          </label>
          <Button type="submit">Save</Button>
        </form>
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
    </div>
  );
}

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
