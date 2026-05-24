import { createAdminClient } from "@/lib/supabase/server";

export default async function AdminBookingsPage() {
  const supabase = createAdminClient();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*")
    .order("scheduled_at", { ascending: false })
    .limit(100);

  const fallbackLeads =
    error || !bookings
      ? (
          await supabase
            .from("leads")
            .select("id,email,name,first_seen,source")
            .eq("source", "book")
            .order("first_seen", { ascending: false })
            .limit(100)
        ).data ?? []
      : [];

  const rows = bookings ?? fallbackLeads.map((lead) => ({
    id: lead.id,
    email: lead.email,
    name: lead.name,
    notes: "Captured from Calendly webhook",
    scheduled_at: lead.first_seen,
    status: "scheduled"
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground mt-1">Discovery calls scheduled via the landing lightbox.</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No bookings yet. As soon as someone books through Calendly, they appear here.
        </p>
      ) : (
        <ul className="rounded-lg border border-border divide-y divide-border">
          {rows.map((b) => (
            <li key={b.id} className="p-4 flex justify-between items-start">
              <div>
                <p className="font-semibold">{b.name ?? b.email}</p>
                <p className="text-xs text-muted-foreground">{b.email}</p>
                {b.notes && <p className="text-sm mt-1 max-w-xl">{b.notes}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{new Date(b.scheduled_at).toLocaleString()}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
