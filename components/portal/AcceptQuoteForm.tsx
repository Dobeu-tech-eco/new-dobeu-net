"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptWorkOrderQuote } from "@/lib/actions/work-orders";

export function AcceptQuoteForm({ ticketId }: { ticketId: string }) {
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

  return (
    <div className="space-y-2">
      <Button onClick={onAccept} disabled={pending}>
        {pending ? "Accepting…" : "Accept quote & create invoice"}
      </Button>
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
