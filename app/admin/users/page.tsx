import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";

export default async function AdminUsersPage() {
  const supabase = createAdminClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,full_name,company,created_at")
    .order("created_at", { ascending: false });

  const adminIds = new Set<string>();
  try {
    const { data: usersList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const user of usersList?.users ?? []) {
      if (isAdminEmail(user.email)) adminIds.add(user.id);
    }
  } catch (e) {
    console.warn("[admin users] auth.admin.listUsers failed:", e);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-1">Everyone with a portal account.</p>
      </header>

      {!profiles || profiles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No users yet. The first user is created on first magic-link login.
        </p>
      ) : (
        <ul className="rounded-lg border border-border divide-y divide-border">
          {profiles.map((p) => (
            <li key={p.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{p.full_name ?? "(no name set)"}</p>
                <p className="text-xs text-muted-foreground">{p.company ?? "—"}</p>
                {adminIds.has(p.id) && (
                  <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-bold bg-accent/15 text-accent rounded px-1.5 py-0.5">
                    Admin
                  </span>
                )}
              </div>
              <Link
                href={`/admin/users/${p.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Edit →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
