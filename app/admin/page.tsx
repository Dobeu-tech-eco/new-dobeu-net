import { createAdminClient } from "@/lib/supabase/server";
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  ClipboardList,
  FolderKanban,
  Inbox,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-status";
import type { WorkOrderStatus } from "@/lib/domain-types";
import {
  AdminActivityFeed,
  mergeActivity,
} from "@/components/admin/AdminActivityFeed";
import {
  AdminStatusBanner,
  type AdminStatusParams,
} from "@/components/admin/AdminStatusBanner";

const DASH = "\u2014";
const FEED_SOURCE_LIMIT = 10;
const PAID_AT_EPOCH = "1970-01-01T00:00:00Z";
const OPEN_INVOICE_STATUSES = ["open", "overdue"] as const;
// Terminal statuses (closed, cancelled) are not "work in flight".
const OPEN_WORK_ORDER_STATUSES = [
  "open",
  "quoted",
  "accepted",
  "in_progress",
  "delivered",
] as const satisfies readonly WorkOrderStatus[];

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<AdminStatusParams>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const thirtyDaysAgo = since.toISOString();

  const countHead = { count: "exact", head: true } as const;
  const [
    leadsRes,
    leadsCountRes,
    bookingsRes,
    openInvoicesRes,
    openInvoicesCountRes,
    paidInvoicesRes,
    paidInvoicesCountRes,
    usersRes,
    companiesRes,
    activeProjectsRes,
    feedOrdersRes,
    feedInvoicesRes,
    feedPaidInvoicesRes,
    feedProjectsRes,
    feedAuditRes,
    ...workOrderCountRes
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id,email,name,source,first_seen,utm_source")
      .order("first_seen", { ascending: false })
      .limit(10),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("first_seen", thirtyDaysAgo),
    supabase
      .from("bookings")
      .select("id,email,name,scheduled_at,status")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(10),
    // Sums are bounded by PostgREST max_rows; the head counts below detect truncation.
    supabase
      .from("invoices")
      .select("amount_cents,status")
      .in("status", OPEN_INVOICE_STATUSES)
      .order("id"),
    supabase
      .from("invoices")
      .select("id", countHead)
      .in("status", OPEN_INVOICE_STATUSES),
    supabase
      .from("invoices")
      .select("amount_cents,status")
      .eq("status", "paid")
      .gte("paid_at", thirtyDaysAgo)
      .order("id"),
    supabase
      .from("invoices")
      .select("id", countHead)
      .eq("status", "paid")
      .gte("paid_at", thirtyDaysAgo),
    supabase.from("profiles").select("id", countHead),
    supabase.from("companies").select("id", countHead),
    supabase.from("projects").select("id", countHead).eq("status", "active"),
    supabase
      .from("work_orders")
      .select("id,title,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(FEED_SOURCE_LIMIT),
    supabase
      .from("invoices")
      .select("id,amount_cents,currency,created_at,paid_at")
      .order("created_at", { ascending: false })
      .limit(FEED_SOURCE_LIMIT),
    // Payments on older invoices would be missed by the created_at slice above.
    // gte(epoch) excludes NULL paid_at (equivalent to NOT NULL) so unpaid rows
    // can't fill the slice when sorting descending.
    supabase
      .from("invoices")
      .select("id,amount_cents,paid_at")
      .gte("paid_at", PAID_AT_EPOCH)
      .order("paid_at", { ascending: false })
      .limit(FEED_SOURCE_LIMIT),
    supabase
      .from("projects")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(FEED_SOURCE_LIMIT),
    // Never select `data`: audit payloads can hold emails and other PII.
    supabase
      .from("admin_audit_log")
      .select("id,action,target_type,created_at")
      .order("created_at", { ascending: false })
      .limit(FEED_SOURCE_LIMIT),
    ...OPEN_WORK_ORDER_STATUSES.map((status) =>
      supabase.from("work_orders").select("id", countHead).eq("status", status),
    ),
  ]);

  const recentLeads = leadsRes.data ?? [];
  const upcomingBookings = bookingsRes.data ?? [];
  const sumByStatus = (status: string) =>
    (openInvoicesRes.data ?? [])
      .filter((i) => i.status === status)
      .reduce((sum, i) => sum + i.amount_cents, 0);
  const paidTotal = (paidInvoicesRes.data ?? []).reduce(
    (sum, i) => sum + i.amount_cents,
    0,
  );
  // A sum is only trustworthy when it covers every matching row.
  const openReadFailed = Boolean(
    openInvoicesRes.error || openInvoicesCountRes.error,
  );
  const openTruncated =
    !openReadFailed &&
    (openInvoicesCountRes.count ?? 0) > (openInvoicesRes.data ?? []).length;
  const paidReadFailed = Boolean(
    paidInvoicesRes.error || paidInvoicesCountRes.error,
  );
  const paidTruncated =
    !paidReadFailed &&
    (paidInvoicesCountRes.count ?? 0) > (paidInvoicesRes.data ?? []).length;
  const sumValue = (
    failed: boolean,
    truncated: boolean,
    cents: () => number,
  ) => (failed || truncated ? DASH : formatCurrency(cents()));

  const feedSources = [
    feedOrdersRes,
    feedInvoicesRes,
    feedPaidInvoicesRes,
    feedProjectsRes,
    feedAuditRes,
  ];
  const activity = mergeActivity([
    (feedOrdersRes.data ?? []).map((o) => ({
      key: `wo-${o.id}`,
      at: o.updated_at,
      label: `Ticket ${o.updated_at === o.created_at ? "created" : "updated"}: ${o.title}`,
      href: `/admin/tickets/${o.id}`,
    })),
    (feedInvoicesRes.data ?? []).map((i) => ({
      key: `inv-created-${i.id}`,
      at: i.created_at,
      label: `Invoice created: ${formatCurrency(i.amount_cents)}`,
      href: "/admin/invoices",
    })),
    (feedPaidInvoicesRes.data ?? []).map((i) => ({
      key: `inv-paid-${i.id}`,
      at: i.paid_at as string,
      label: `Invoice paid: ${formatCurrency(i.amount_cents)}`,
      href: "/admin/invoices",
    })),
    (feedProjectsRes.data ?? []).map((p) => ({
      key: `proj-${p.id}`,
      at: p.updated_at,
      label: `Project updated: ${p.title}`,
      href: `/admin/projects/${p.id}`,
    })),
    (feedAuditRes.data ?? []).map((a) => ({
      key: `audit-${a.id}`,
      at: a.created_at,
      label: `${a.action} (${a.target_type})`,
    })),
  ]);

  const tileReads = [
    leadsRes,
    leadsCountRes,
    bookingsRes,
    openInvoicesRes,
    openInvoicesCountRes,
    paidInvoicesRes,
    paidInvoicesCountRes,
    usersRes,
    companiesRes,
    activeProjectsRes,
    ...workOrderCountRes,
  ];
  const countValue = (res: { count: number | null; error: unknown }) =>
    res.error ? DASH : (res.count ?? 0).toString();

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

      <AdminStatusBanner
        error={params.error}
        loadError={
          tileReads.some((r) => r.error)
            ? ADMIN_ERROR_MESSAGES.overview_load_failed
            : null
        }
      />

      {(openTruncated || paidTruncated) && (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          {ADMIN_ERROR_MESSAGES.totals_truncated}
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          icon={<Inbox />}
          label="New leads (30d)"
          value={countValue(leadsCountRes)}
        />
        <Tile
          icon={<CalendarCheck />}
          label="Upcoming bookings"
          value={bookingsRes.error ? DASH : upcomingBookings.length.toString()}
        />
        <Tile
          icon={<Receipt />}
          label="Open invoice total"
          value={sumValue(openReadFailed, openTruncated, () =>
            sumByStatus("open"),
          )}
        />
        <Tile
          icon={<Users />}
          label="Client users"
          value={countValue(usersRes)}
        />
        <Tile
          icon={<AlertTriangle />}
          label="Overdue invoice total"
          value={sumValue(openReadFailed, openTruncated, () =>
            sumByStatus("overdue"),
          )}
        />
        <Tile
          icon={<Wallet />}
          label="Paid (30d)"
          value={sumValue(paidReadFailed, paidTruncated, () => paidTotal)}
        />
        <Tile
          icon={<FolderKanban />}
          label="Active projects"
          value={countValue(activeProjectsRes)}
        />
        <Tile
          icon={<Building2 />}
          label="Companies"
          value={countValue(companiesRes)}
        />
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">
          Work orders by status
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {OPEN_WORK_ORDER_STATUSES.map((status, i) => (
            <Tile
              key={status}
              icon={<ClipboardList />}
              label={`Work orders: ${status.replace("_", " ")}`}
              value={countValue(workOrderCountRes[i])}
            />
          ))}
        </div>
      </section>

      <AdminActivityFeed
        entries={activity}
        hasFailedSource={feedSources.some((r) => r.error)}
      />

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">
          Recent leads
        </h2>
        {leadsRes.error ? null : recentLeads.length === 0 ? (
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
        {bookingsRes.error ? null : upcomingBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-6 text-center">
            No upcoming bookings yet.
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
