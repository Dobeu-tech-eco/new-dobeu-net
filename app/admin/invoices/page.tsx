import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export default async function AdminInvoicesPage() {
  const supabase = createAdminClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id,project_id,amount_cents,currency,status,due_date,paid_at,stripe_invoice_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const open = invoices?.filter((i) => i.status === "open" || i.status === "overdue") ?? [];
  const paid = invoices?.filter((i) => i.status === "paid") ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground mt-1">
          Open: <strong>{open.length}</strong> ·{" "}
          Open total: <strong>{formatCurrency(open.reduce((s, i) => s + i.amount_cents, 0))}</strong>
        </p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="p-3 font-mono text-xs">{inv.id.slice(0, 8)}…</td>
                  <td className="p-3 font-semibold">{formatCurrency(inv.amount_cents, inv.currency)}</td>
                  <td className="p-3 uppercase tracking-wider text-xs">{inv.status}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    {inv.stripe_invoice_id ? (
                      <a
                        href={`https://dashboard.stripe.com/invoices/${inv.stripe_invoice_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        open →
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
