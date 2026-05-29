import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,company,avatar_url")
    .eq("id", user!.id)
    .single();

  return (
    <div className="space-y-6 max-w-xl">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Settings
        </h1>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-semibold">Account</h2>
        <dl className="space-y-2 text-sm">
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Name" value={profile?.full_name ?? "—"} />
          <Row label="Company" value={profile?.company ?? "—"} />
          <Row
            label="Last sign-in"
            value={
              user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString()
                : "—"
            }
          />
        </dl>
        <p className="text-xs text-muted-foreground pt-2">
          Editing profile fields is coming in v2. For now, email{" "}
          <a href="mailto:jeremyw@dobeu.net" className="underline">
            jeremyw@dobeu.net
          </a>{" "}
          to update.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
