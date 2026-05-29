import { createAdminClient } from "@/lib/supabase/server";
import { Inbox, CalendarCheck, Receipt, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default async function AdminOverview() {
  const supabase = createAdminClient();

  const [leadsRes, bookingsRes, openInvoicesRes, usersRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id,email,name,source,first_seen,utm_source")
      .order("first_seen", { ascending: false })
      .limit(10),
    supabase
      .from("bookings")
      .select("id,email,name,scheduled_at,status")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(10),
    supabase
      .from("invoices")
      .select("id,amount_cents,currency,status,due_date")
      .in("status", ["open", "overdue"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const recentLeads = leadsRes.data ?? [];
  const upcomingBookings = bookingsRes.data ?? [];
  const openInvoiceTotal = (openInvoicesRes.data ?? []).reduce(
    (sum, i) => sum + i.amount_cents,
    0,
  );
  const userCount = usersRes.count ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Overview
        </h1>
        <p className="text-muted-foreground mt-1">
          Everything coming through dobeu.net.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          icon={<Inbox />}
          label="New leads (30d)"
          value={recentLeads.length.toString()}
        />
        <Tile
          icon={<CalendarCheck />}
          label="Upcoming bookings"
          value={upcomingBookings.length.toString()}
        />
        <Tile
          icon={<Receipt />}
          label="Open invoice total"
          value={formatCurrency(openInvoiceTotal)}
        />
        <Tile
          icon={<Users />}
          label="Client users"
          value={userCount.toString()}
        />
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">
          Recent leads
        </h2>
        {recentLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-6 text-center">
            No leads yet. As soon as someone submits a form on dobeu.net, they
            show up here.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {recentLeads.map((l) => (
              <li
                key={l.id}
                className="p-4 grid grid-cols-[1fr_auto] items-center gap-2"
              >
                <div>
                  <p className="font-medium">{l.name ?? l.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.email} · source:{" "}
                    <span className="uppercase tracking-wider">{l.source}</span>
                    {l.utm_source && <> · utm: {l.utm_source}</>}
                  </p>
                </div>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={l.first_seen}
                >
                  {new Date(l.first_seen).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">
          Upcoming bookings
        </h2>
        {upcomingBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-6 text-center">
            No upcoming bookings. Verify Apollo Meetings wiring in{" "}
            <code>NEXT_PUBLIC_APOLLO_MEETINGS_URL</code>.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {upcomingBookings.map((b) => (
              <li key={b.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{b.name ?? b.email}</p>
                  <p className="text-xs text-muted-foreground">{b.email}</p>
                </div>
                <time className="text-sm">
                  {new Date(b.scheduled_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-muted-foreground mb-3 h-5">{icon}</div>
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
