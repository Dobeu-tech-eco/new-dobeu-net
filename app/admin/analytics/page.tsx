export default function AdminAnalyticsPage() {
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Live dashboards. Drill in via the linked tools — embeds will land in v2.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <Tile
          label="PostHog (product)"
          desc="Funnels, retention, session replay, feature flags"
          href={`${posthogHost}/project/dashboard`}
        />
        <Tile
          label="Mixpanel (funnel)"
          desc="Acquisition → activation → conversion funnel"
          href="https://mixpanel.com/report/"
        />
        <Tile
          label="Google Analytics 4"
          desc="Acquisition channels, paid attribution"
          href="https://analytics.google.com/"
        />
        <Tile
          label="Apollo (CRM)"
          desc="Lead enrichment, account health, outbound"
          href="https://app.apollo.io/#/control-center"
        />
      </div>
    </div>
  );
}

function Tile({ label, desc, href }: { label: string; desc: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-glow transition-all"
    >
      <p className="font-display text-lg font-semibold">{label}</p>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      <p className="text-xs text-primary mt-3 font-medium">Open in new tab →</p>
    </a>
  );
}
