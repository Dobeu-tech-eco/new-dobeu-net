/**
 * Admin: work-order tickets list (Phase 3).
 *
 * Reads via service-role admin client (RLS bypass). Filter chips drive the
 * query through searchParams so filters are bookmarkable + work with browser
 * back/forward.
 */
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WorkOrderStatus, WorkOrderServiceType } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const STATUSES: ("all" | WorkOrderStatus)[] = [
  "all",
  "open",
  "quoted",
  "accepted",
  "in_progress",
  "delivered",
  "closed",
  "cancelled"
];

const SERVICE_TYPES: ("all" | WorkOrderServiceType)[] = [
  "all",
  "logo",
  "website_update",
  "data_export",
  "consulting",
  "other"
];

function statusTone(status: string): "indigo" | "amber" | "neutral" {
  switch (status) {
    case "open":
    case "quoted":
      return "amber";
    case "accepted":
    case "in_progress":
      return "indigo";
    default:
      return "neutral";
  }
}

interface PageProps {
  searchParams: Promise<{ status?: string; service_type?: string }>;
}

export default async function AdminTicketsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = (sp.status ?? "all") as "all" | WorkOrderStatus;
  const serviceType = (sp.service_type ?? "all") as "all" | WorkOrderServiceType;

  const admin = createAdminClient();
  let query = admin
    .from("work_orders")
    .select("id,title,service_type,status,created_at,quoted_amount_cents,created_by")
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (serviceType !== "all") query = query.eq("service_type", serviceType);

  const { data: tickets, error } = await query;

  // Resolve owner emails in a single bulk lookup against the auth admin API
  // is expensive; for now we just show the user-id prefix. The detail page
  // does the full email lookup.
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Tickets</h1>
        <p className="text-muted-foreground mt-1">
          All work-order tickets across all clients. Click into one to quote, transition, or invoice.
        </p>
      </header>

      <div className="space-y-2">
        <FilterRow label="Status" param="status" current={status} options={STATUSES} keep={{ service_type: serviceType }} />
        <FilterRow label="Service" param="service_type" current={serviceType} options={SERVICE_TYPES} keep={{ status }} />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error.message}
        </p>
      )}

      {!tickets || tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">No tickets matching those filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Title</th>
                <th className="p-3">Service</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Status</th>
                <th className="p-3">Quote</th>
                <th className="p-3">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <Link
                      href={`/admin/tickets/${t.id}`}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{t.service_type}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {t.created_by.slice(0, 8)}…
                  </td>
                  <td className="p-3">
                    <Badge tone={statusTone(t.status as WorkOrderStatus)}>{t.status}</Badge>
                  </td>
                  <td className="p-3">
                    {t.quoted_amount_cents
                      ? formatCurrency(t.quoted_amount_cents)
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
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

function FilterRow<T extends string>({
  label,
  param,
  current,
  options,
  keep
}: {
  label: string;
  param: string;
  current: T;
  options: readonly T[];
  keep: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">{label}:</span>
      {options.map((o) => {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(keep)) {
          if (v && v !== "all") sp.set(k, v);
        }
        if (o !== "all") sp.set(param, o);
        const href = sp.toString() ? `/admin/tickets?${sp}` : "/admin/tickets";
        const active = current === o;
        return (
          <Link
            key={o}
            href={href}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              active
                ? "border-accent bg-accent/10 text-accent font-semibold"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {o}
          </Link>
        );
      })}
    </div>
  );
}
