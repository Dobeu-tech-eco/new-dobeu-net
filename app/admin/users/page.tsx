import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";
import { InviteUserForm } from "@/components/admin/InviteUserForm";
import {
  AdminStatusBanner,
  type AdminStatusParams,
} from "@/components/admin/AdminStatusBanner";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<AdminStatusParams>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id,full_name,company,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const adminIds = new Set<string>();
  let authError = false;
  try {
    const { data: usersList, error: usersError } =
      await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    authError = Boolean(usersError);
    for (const user of usersList?.users ?? []) {
      if (isAdminEmail(user.email)) adminIds.add(user.id);
    }
  } catch (e) {
    authError = true;
    console.warn("[admin users] auth.admin.listUsers failed:", e);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Users
        </h1>
        <p className="text-muted-foreground mt-1">
          Everyone with a portal account.
        </p>
      </header>

      <AdminStatusBanner
        error={params.error}
        loadError={
          error || authError
            ? "Unable to load users or admin roles. Try again."
            : null
        }
      />

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold mb-1">
          Invite a user
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Sends a Supabase invite email. The profile row is created when they
          accept.
        </p>
        <InviteUserForm />
      </section>

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
                <p className="text-xs text-muted-foreground">
                  {p.company ?? "—"}
                </p>
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
