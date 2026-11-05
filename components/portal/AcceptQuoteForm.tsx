"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { acceptWorkOrderQuote } from "@/lib/actions/work-orders";

const STATUS_CONFLICT_COPY =
  "This quote changed while you were viewing it. The page has been refreshed; check the latest status and try again.";

export function AcceptQuoteForm({
  ticketId,
  amountCents
}: {
  ticketId: string;
  amountCents: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptWorkOrderQuote({ id: ticketId });
      if (!result.ok) {
        if (result.error === "status_conflict") {
          setError(STATUS_CONFLICT_COPY);
          router.refresh();
        } else {
          setError(result.error);
        }
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
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
