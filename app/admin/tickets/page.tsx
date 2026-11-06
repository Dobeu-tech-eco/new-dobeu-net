/**
 * Admin: work-order tickets list (Phase 3).
 *
 * Reads via service-role admin client (RLS bypass). Filter chips drive the
 * query through searchParams so filters are bookmarkable + work with browser
 * back/forward.
 */
import Link from "next/link";
import { AdminStatusBanner } from "@/components/admin/AdminStatusBanner";
import { createAdminClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/admin-user-list";
import { formatCurrency, cn } from "@/lib/utils";
import { NewWorkOrderForClientDialog } from "@/components/admin/NewWorkOrderForClientDialog";
import { Badge } from "@/components/ui/badge";
import type { WorkOrderStatus, WorkOrderServiceType } from "@/lib/domain-types";

export const dynamic = "force-dynamic";

const STATUSES: ("all" | WorkOrderStatus)[] = [
  "all",
  "open",
  "quoted",
  "accepted",
  "in_progress",
  "delivered",
  "closed",
  "cancelled",
];

const SERVICE_TYPES: ("all" | WorkOrderServiceType)[] = [
  "all",
  "logo",
  "website_update",
  "data_export",
  "consulting",
  "other",
];

function serviceLabel(value: string): string {
  return value === "consulting" ? "Business systems" : value.replace(/_/g, " ");
}

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
  searchParams: Promise<{
    status?: string;
    service_type?: string;
    error?: string;
  }>;
}

export default async function AdminTicketsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = (sp.status ?? "all") as "all" | WorkOrderStatus;
  const serviceType = (sp.service_type ?? "all") as
    "all" | WorkOrderServiceType;

  const admin = createAdminClient();
  let query = admin
    .from("work_orders")
    .select(
      "id,title,service_type,status,created_at,quoted_amount_cents,created_by",
    )
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (serviceType !== "all") query = query.eq("service_type", serviceType);

  const [
    { data: tickets, error },
    clientList,
    { data: companies, error: companiesError },
    { data: projects, error: projectsError },
  ] = await Promise.all([
    query,
    listAllUsers(admin),
    admin
      .from("companies")
      .select("id,name")
      .eq("status", "active")
      .order("name")
      .limit(200),
    admin
      .from("projects")
      .select("id,title,owner_user_id,company_id")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const pickerError = !!(clientList.failed || companiesError || projectsError);
  const clientOptions = clientList.users.map((client) => ({
    id: client.id,
    label: client.email ?? client.id.slice(0, 8),
  }));

  // Resolve owner emails in a single bulk lookup against the auth admin API
  // is expensive; for now we just show the user-id prefix. The detail page
  // does the full email lookup.
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Tickets
          </h1>
          <p className="text-muted-foreground mt-1">
            All work-order tickets across all clients. Click into one to quote,
            transition, or invoice.
          </p>
        </div>
        <NewWorkOrderForClientDialog
          clients={clientOptions}
          companies={companies ?? []}
          projects={projects ?? []}
          disabled={pickerError}
        />
      </header>
      {pickerError && (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          Work posting options could not be loaded. Post work is unavailable.
          Tickets are still shown when available.
        </p>
      )}

      {!pickerError && clientList.truncated && (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          The client list may be truncated; some clients may not appear in the
          Post work picker.
        </p>
      )}

      <div className="space-y-2">
        <FilterRow
          label="Status"
          param="status"
          current={status}
          options={STATUSES}
          keep={{ service_type: serviceType }}
        />
        <FilterRow
          label="Service"
          param="service_type"
          current={serviceType}
          options={SERVICE_TYPES}
          keep={{ status }}
        />
      </div>

      <AdminStatusBanner
        error={sp.error}
        loadError={error ? "Unable to load tickets. Try again." : null}
      />

      {error ? null : !tickets || tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">No tickets matching those filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">All client work-order tickets</caption>
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="p-3">
                  Title
                </th>
                <th scope="col" className="p-3">
                  Service
                </th>
                <th scope="col" className="p-3">
                  Owner
                </th>
                <th scope="col" className="p-3">
                  Status
                </th>
                <th scope="col" className="p-3">
                  Quote
                </th>
                <th scope="col" className="p-3">
                  Opened
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <Link
                      href={`/admin/tickets/${t.id}`}
                      className="font-semibold underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {serviceLabel(t.service_type)}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {t.created_by.slice(0, 8)}…
                  </td>
                  <td className="p-3">
                    <Badge
                      tone={statusTone(t.status as WorkOrderStatus)}
                      aria-label={`Status: ${t.status.replace(/_/g, " ")}`}
                    >
                      {t.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {t.quoted_amount_cents ? (
                      formatCurrency(t.quoted_amount_cents)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
  keep,
}: {
  label: string;
  param: string;
  current: T;
  options: readonly T[];
  keep: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
        {label}:
      </span>
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
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-accent bg-accent/10 text-accent font-semibold"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {param === "service_type" ? serviceLabel(o) : o}
          </Link>
        );
      })}
    </div>
  );
}
