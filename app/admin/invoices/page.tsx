import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NewInvoiceDialog } from "@/components/admin/NewInvoiceDialog";
import { AdminMarkPaidButton } from "@/components/admin/AdminMarkPaidButton";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  const supabase = createAdminClient();
  const [{ data: invoices }, { data: profilesData }, { data: projects }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id,project_id,amount_cents,currency,status,due_date,paid_at,stripe_invoice_id,hosted_invoice_url,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id,full_name,company").limit(500),
    supabase.from("projects").select("id,title,owner_user_id").limit(500)
  ]);

  // Resolve auth emails for the picker — bulk via auth admin.
  let usersForPicker: Array<{ id: string; label: string }> = [];
  try {
    const { data: usersList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const profilesById = new Map((profilesData ?? []).map((p) => [p.id, p]));
    usersForPicker = (usersList?.users ?? []).map((u) => {
      const prof = profilesById.get(u.id);
      const label = prof?.full_name
        ? `${prof.full_name} <${u.email ?? "?"}>`
        : (u.email ?? u.id);
      return { id: u.id, label };
    });
  } catch (e) {
    // Picker will fall back to empty -- "no users yet" message.
    console.warn("[admin invoices] auth.admin.listUsers failed:", e);
  }

  const projectOptions = (projects ?? []).map((p) => ({
    id: p.id,
    label: p.title,
    ownerUserId: p.owner_user_id
  }));

  const open = invoices?.filter((i) => i.status === "open" || i.status === "overdue") ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Open: <strong>{open.length}</strong> ·{" "}
            Open total: <strong>{formatCurrency(open.reduce((s, i) => s + i.amount_cents, 0))}</strong>
          </p>
        </div>
        <NewInvoiceDialog users={usersForPicker} projects={projectOptions} />
      </header>

      {!invoices || invoices.length === 0 ? (
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
                  <td className="p-3 font-mono text-xs">{inv.id.slice(0, 8)}…</td>
                  <td className="p-3 font-semibold">{formatCurrency(inv.amount_cents, inv.currency)}</td>
                  <td className="p-3">
                    <Badge tone={inv.status === "paid" ? "neutral" : inv.status === "overdue" ? "amber" : "indigo"}>
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    {inv.hosted_invoice_url ? (
                      <a
                        href={inv.hosted_invoice_url}
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
                      <span className="text-muted-foreground">draft (no Stripe id)</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {inv.status !== "paid" && <AdminMarkPaidButton invoiceId={inv.id} />}
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
