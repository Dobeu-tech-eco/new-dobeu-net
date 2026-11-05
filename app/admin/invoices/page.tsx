import { createAdminClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/admin-user-list";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NewInvoiceDialog } from "@/components/admin/NewInvoiceDialog";
import { AdminMarkPaidButton } from "@/components/admin/AdminMarkPaidButton";
import {
  AdminStatusBanner,
  type AdminStatusParams,
} from "@/components/admin/AdminStatusBanner";
import { safeStripeInvoiceUrl } from "@/lib/stripe-url";

export const dynamic = "force-dynamic";

const WORK_ORDER_PICKER_LIMIT = 500;

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<AdminStatusParams>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const [
    { data: invoices, error: invoicesError },
    { data: profilesData, error: profilesError },
    { data: projects, error: projectsError },
    { data: unbilledWorkOrders, error: workOrdersError },
    { data: voidedWorkOrders, error: voidedWorkOrdersError },
    { users: authUsers, failed: authError, truncated },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id,project_id,amount_cents,currency,status,due_date,paid_at,stripe_invoice_id,hosted_invoice_url,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id,full_name,company").limit(500),
    supabase.from("projects").select("id,title,owner_user_id").limit(500),
    // Billable work orders come from two reads (merged below): accepted ones
    // with no invoice, and accepted ones whose linked invoice is void (voiding
    // never clears work_orders.invoice_id, but the server allows a re-bill).
    // Each read is newest first so a cap never drops recent rows for old
    // already-billed tickets.
    supabase
      .from("work_orders")
      .select("id,title,created_by,created_at")
      .is("invoice_id", null)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(WORK_ORDER_PICKER_LIMIT),
    supabase
      .from("work_orders")
      .select(
        "id,title,created_by,created_at,invoices!work_orders_invoice_id_fkey!inner(status)",
      )
      .eq("status", "accepted")
      .eq("invoices.status", "void")
      .order("created_at", { ascending: false })
      .limit(WORK_ORDER_PICKER_LIMIT),
    // Resolve auth emails for the picker — bulk via auth admin.
    listAllUsers(supabase),
  ]);

  const profilesById = new Map((profilesData ?? []).map((p) => [p.id, p]));
  const usersForPicker: Array<{ id: string; label: string }> = authUsers.map(
    (u) => {
      const prof = profilesById.get(u.id);
      const label = prof?.full_name
        ? `${prof.full_name} <${u.email ?? "?"}>`
        : (u.email ?? u.id);
      return { id: u.id, label };
    },
  );

  const projectOptions = (projects ?? []).map((p) => ({
    id: p.id,
    label: p.title,
    ownerUserId: p.owner_user_id,
  }));

  // Both reads are filtered + newest first server-side; merge, re-sort, and
  // keep the same cap. A failed read just contributes no options.
  const workOrderOptions = [
    ...(unbilledWorkOrders ?? []),
    ...(voidedWorkOrders ?? []),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, WORK_ORDER_PICKER_LIMIT)
    .map((w) => ({
      id: w.id,
      label: w.title,
      clientUserId: w.created_by,
    }));

  const pickerError = Boolean(
    profilesError ||
      projectsError ||
      workOrdersError ||
      voidedWorkOrdersError ||
      authError,
  );

  const open =
    invoices?.filter((i) => i.status === "open" || i.status === "overdue") ??
    [];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Invoices
          </h1>
          <p className="text-muted-foreground mt-1">
            Open: <strong>{invoicesError ? "—" : open.length}</strong> · Open
            total:{" "}
            <strong>
              {invoicesError
                ? "—"
                : formatCurrency(open.reduce((s, i) => s + i.amount_cents, 0))}
            </strong>
          </p>
        </div>
        <NewInvoiceDialog
          users={usersForPicker}
          projects={projectOptions}
          workOrders={workOrderOptions}
        />
      </header>

      <AdminStatusBanner
        error={params.error}
        loadError={invoicesError ? "Unable to load invoices. Try again." : null}
      />
      {pickerError && (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          The New Invoice picker could not be fully loaded. Existing invoices
          are shown below.
        </p>
      )}
      {!pickerError && truncated && (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          The client list may be truncated; some clients may not appear in the
          New Invoice picker.
        </p>
      )}

      {invoicesError ? null : !invoices || invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No invoices yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Invoice</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Due</th>
                <th className="p-3">Stripe</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="p-3 font-mono text-xs">
                    {inv.id.slice(0, 8)}…
                  </td>
                  <td className="p-3 font-semibold">
                    {formatCurrency(inv.amount_cents, inv.currency)}
                  </td>
                  <td className="p-3">
                    <Badge
                      tone={
                        inv.status === "paid"
                          ? "neutral"
                          : inv.status === "overdue"
                            ? "amber"
                            : "indigo"
                      }
                    >
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {inv.due_date
                      ? new Date(inv.due_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    {safeStripeInvoiceUrl(inv.hosted_invoice_url) ? (
                      <a
                        href={safeStripeInvoiceUrl(inv.hosted_invoice_url)!}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Stripe invoice →
                      </a>
                    ) : inv.stripe_invoice_id ? (
                      <a
                        href={`https://dashboard.stripe.com/invoices/${inv.stripe_invoice_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        dashboard →
                      </a>
                    ) : (
                      <span className="text-muted-foreground">
                        draft (no Stripe id)
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {inv.status !== "paid" && inv.status !== "void" && (
                      <AdminMarkPaidButton invoiceId={inv.id} />
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
