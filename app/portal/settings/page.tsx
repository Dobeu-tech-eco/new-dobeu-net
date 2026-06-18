import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/portal/SettingsForm";
import { MfaStatus } from "@/components/portal/MfaStatus";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,company,avatar_url,phone,notify_email")
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
            company: profile?.company ?? "",
            phone: profile?.phone ?? "",
            notify_email: profile?.notify_email ?? true
          }}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Two-factor authentication</h2>
        <p className="text-sm text-muted-foreground">
          Required to access the admin area. Adds a one-time code from your authenticator app on top
          of magic-link sign-in.
        </p>
        <MfaStatus />
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
