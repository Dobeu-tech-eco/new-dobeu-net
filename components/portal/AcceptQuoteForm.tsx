"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { acceptWorkOrderQuote } from "@/lib/actions/work-orders";

export function AcceptQuoteForm({
  ticketId,
  amountCents
}: {
  ticketId: string;
  amountCents: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptWorkOrderQuote({ id: ticketId });
      if (!result.ok) {
        setError(result.error);
      }
      // On success, revalidatePath inside the action refreshes this page.
    });
  }

  const quoteLabel = formatCurrency(amountCents);

  return (
    <div className="space-y-2">
      <Button
        onClick={onAccept}
        disabled={pending}
        aria-label={`Accept quote of ${quoteLabel} and create invoice`}
      >
        {pending ? "Accepting…" : "Accept quote & create invoice"}
      </Button>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
