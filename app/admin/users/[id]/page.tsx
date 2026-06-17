import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,full_name,company,apollo_contact_id,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error || !profile) notFound();

  let adminAccess = "No";
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(id);
    if (isAdminEmail(authUser?.user?.email)) adminAccess = "Yes (ADMIN_EMAILS)";
  } catch (e) {
    console.warn("[admin users] auth.admin.getUserById failed:", e);
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to users
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight mt-2">
          {profile.full_name ?? "Unnamed user"}
        </h1>
        <p className="text-muted-foreground mt-1">{profile.company ?? "No company set"}</p>
      </header>

      <section className="rounded-lg border border-border p-5 space-y-3">
        <Row label="User ID" value={profile.id} mono />
        <Row label="Admin access" value={adminAccess} />
        <Row label="Apollo contact id" value={profile.apollo_contact_id ?? "—"} mono />
        <Row label="Created" value={new Date(profile.created_at).toLocaleString()} />
        <Row label="Updated" value={new Date(profile.updated_at).toLocaleString()} />
      </section>

      <section className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
        Edit and role-mutation controls are intentionally deferred in this phase. This page is a safe
        detail scaffold so the users list no longer routes to a 404.
      </section>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-sm break-all" : "text-sm"}>{value}</p>
    </div>
  );
}
