import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id,project_id,amount_cents,currency,status,due_date,paid_at,stripe_invoice_id,hosted_invoice_url",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Invoices
        </h1>
        <p className="text-muted-foreground mt-1">
          Pay open invoices via Stripe.
        </p>
      </header>

      {!invoices || invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">No invoices yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Invoice</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Due</th>
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
                    <span
                      className={
                        inv.status === "paid"
                          ? "text-green-600 dark:text-green-400"
                          : inv.status === "overdue"
                            ? "text-destructive"
                            : "text-accent"
                      }
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {inv.due_date
                      ? new Date(inv.due_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="p-3 text-right">
                    {(inv.status === "open" || inv.status === "overdue") &&
                    inv.hosted_invoice_url ? (
                      <Button asChild size="sm">
                        <a
                          href={inv.hosted_invoice_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Pay
                        </a>
                      </Button>
                    ) : inv.status === "paid" ? (
                      <span className="text-muted-foreground text-xs">
                        Paid
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Pending
                      </span>
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
