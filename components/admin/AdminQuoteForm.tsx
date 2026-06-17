"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quoteWorkOrder } from "@/lib/actions/work-orders";

export function AdminQuoteForm({ ticketId }: { ticketId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    const dollars = Number(formData.get("amount") ?? 0);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a positive dollar amount.");
      return;
    }
    const amount_cents = Math.round(dollars * 100);
    startTransition(async () => {
      const result = await quoteWorkOrder({ id: ticketId, amount_cents });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="amount">Quote amount (USD)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="500.00"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Send quote to client"}
      </Button>
    </form>
  );
}
