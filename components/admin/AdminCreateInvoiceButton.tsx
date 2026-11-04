"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createInvoiceForWorkOrder } from "@/lib/actions/invoices";
import { formatCurrency } from "@/lib/utils";

/**
 * Admin "Create Stripe Invoice" action for an accepted work order.
 * This is the locked Stripe model's create path: the client accepts a quote
 * (status → accepted), then the admin issues the hosted invoice here.
 */
export function AdminCreateInvoiceButton({
  workOrderId,
  amountCents
}: {
  workOrderId: string;
  amountCents: number;
}) {
  const [error, setError] = useState<string | null>(null);
  // Set when the invoice was created but not linked to the work order; the
  // button then stays disabled so a second click cannot bill the client twice.
  const [linkFailedInvoiceId, setLinkFailedInvoiceId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    if (
      !confirm(
        `Create a Stripe invoice for ${formatCurrency(amountCents)}? The client will be emailed a hosted payment link.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await createInvoiceForWorkOrder({ work_order_id: workOrderId });
      if (!result.ok) setError(result.error);
      else if (result.data.linkFailed) setLinkFailedInvoiceId(result.data.id);
    });
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={onClick}
        disabled={pending || linkFailedInvoiceId !== null}
        aria-busy={pending}
        aria-describedby={
          error
            ? `create-invoice-error-${workOrderId}`
            : linkFailedInvoiceId
              ? `create-invoice-link-failed-${workOrderId}`
              : undefined
        }
      >
        {pending ? "Creating invoice…" : `Create Stripe invoice (${formatCurrency(amountCents)})`}
      </Button>
      {error && (
        <p
          id={`create-invoice-error-${workOrderId}`}
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {linkFailedInvoiceId && (
        <p
          id={`create-invoice-link-failed-${workOrderId}`}
          role="status"
          className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-sm"
        >
          {`Invoice ${linkFailedInvoiceId} was created but could not be linked to the work order. To link it, set work_orders.invoice_id = ${linkFailedInvoiceId} in Supabase. To bill again instead, void it in the Stripe dashboard (find it on /admin/invoices) and wait for the webhook to mark it void.`}
        </p>
      )}
    </div>
  );
}
