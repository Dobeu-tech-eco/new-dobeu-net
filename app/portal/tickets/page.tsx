/**
 * Portal: work-order tickets list (Phase 3).
 *
 * Owner-scoped via RLS — `created_by = auth.uid()` is the only policy on the
 * `work_orders` table for non-admin users, so this `select(*)` is naturally
 * filtered.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NewWorkOrderDialog } from "@/components/portal/NewWorkOrderDialog";
import type { WorkOrderStatus } from "@/lib/database.types";

export const dynamic = "force-dynamic";

function statusTone(status: string): "indigo" | "amber" | "neutral" {
  switch (status) {
    case "open":
    case "quoted":
      return "amber";
    case "accepted":
    case "in_progress":
      return "indigo";
    case "delivered":
    case "closed":
      return "neutral";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

const SERVICE_LABELS: Record<string, string> = {
  logo: "Logo",
  website_update: "Website update",
  data_export: "Data export",
  consulting: "Consulting",
  other: "Other"
};

export default async function TicketsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/tickets");

  const { data: tickets, error } = await supabase
    .from("work_orders")
    .select(
      "id,title,service_type,status,created_at,quoted_amount_cents,invoice_id"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground mt-1">
            Open a ticket for any new design, build, or consulting work.
          </p>
        </div>
        <NewWorkOrderDialog />
      </header>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Couldn&apos;t load tickets: {error.message}
        </p>
      )}

      {!tickets || tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">No tickets yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Hit &ldquo;New ticket&rdquo; above to send me your first one.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Your work-order tickets</caption>
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="p-3">
                  Title
                </th>
                <th scope="col" className="p-3">
                  Service
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
                      href={`/portal/tickets/${t.id}`}
                      className="font-semibold underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {SERVICE_LABELS[t.service_type] ?? t.service_type}
                  </td>
                  <td className="p-3">
                    <Badge tone={statusTone(t.status as WorkOrderStatus)} aria-label={`Status: ${t.status.replace(/_/g, " ")}`}>
                      {t.status.replace(/_/g, " ")}
                    </Badge>
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
