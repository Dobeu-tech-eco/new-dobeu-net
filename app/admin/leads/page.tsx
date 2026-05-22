import { createAdminClient } from "@/lib/supabase/server";

export default async function AdminLeadsPage() {
  const supabase = createAdminClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id,email,name,company,source,utm_source,utm_campaign,referrer,first_seen,apollo_contact_id")
    .order("first_seen", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground mt-1">Every form submission to dobeu.net.</p>
      </header>

      {!leads || leads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No leads yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Source</th>
                <th className="p-3">UTM</th>
                <th className="p-3">Apollo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="p-3 whitespace-nowrap text-xs">
                    {new Date(l.first_seen).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{l.name ?? l.email}</p>
                    <p className="text-xs text-muted-foreground">{l.email}</p>
                    {l.company && (
                      <p className="text-xs text-muted-foreground">{l.company}</p>
                    )}
                  </td>
                  <td className="p-3 uppercase tracking-wider text-xs">{l.source}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {l.utm_source ? `${l.utm_source} / ${l.utm_campaign ?? "—"}` : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    {l.apollo_contact_id ? (
                      <a
                        href={`https://app.apollo.io/#/people/${l.apollo_contact_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        view →
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
