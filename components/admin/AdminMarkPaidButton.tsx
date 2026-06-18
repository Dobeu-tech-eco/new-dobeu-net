"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markInvoicePaidManually } from "@/lib/actions/invoices";

export function AdminMarkPaidButton({ invoiceId }: { invoiceId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    if (!confirm("Mark this invoice as paid manually? Use only for cash / wire / check payments outside Stripe.")) {
      return;
    }
    startTransition(async () => {
      const result = await markInvoicePaidManually({ id: invoiceId });
      if (!result.ok) setError(result.error);
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
        aria-describedby={error ? `mark-paid-error-${invoiceId}` : undefined}
      >
        {pending ? "Marking…" : "Mark paid manually"}
      </Button>
      {error && (
        <p
          id={`mark-paid-error-${invoiceId}`}
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
