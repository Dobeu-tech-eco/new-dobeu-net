"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { voidUnsentInvoice } from "@/lib/actions/invoices";

/**
 * Voids an invoice that never reached Stripe (open, no stripe_invoice_id).
 * To retry billing, void first, then create the invoice again.
 */
export function AdminVoidUnsentInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    if (
      !confirm(
        "Void this unsent invoice? The Stripe call failed. Check the Stripe dashboard for this customer before re-billing; a re-bill within 24 hours reuses the same request safely."
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await voidUnsentInvoice({ id: invoiceId });
        if (!result.ok) setError(result.error);
      } catch {
        setError("Unable to void the invoice. Try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={error ? `void-unsent-error-${invoiceId}` : undefined}
      >
        {pending ? "Voiding…" : "Void unsent"}
      </Button>
      {error && (
        <p
          id={`void-unsent-error-${invoiceId}`}
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
