import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/portal/SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,company,avatar_url")
    .eq("id", user!.id)
    .single();

  return (
    <div className="space-y-6 max-w-xl">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Update your profile. Email is set by your magic-link account.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Account</h2>
        <dl className="space-y-1 text-sm">
          <Row label="Email" value={user?.email ?? "—"} />
          <Row
            label="Last sign-in"
            value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"}
          />
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <SettingsForm
          initial={{
            full_name: profile?.full_name ?? "",
            company: profile?.company ?? ""
          }}
        />
        <p className="text-xs text-muted-foreground">
          Phone is collected for the future ticketing flow but isn&apos;t yet stored on your profile.
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
