"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateWorkOrderStatus } from "@/lib/actions/work-orders";

type Status = "in_progress" | "delivered" | "closed" | "cancelled";

const NEXT_OPTIONS: Record<string, Array<{ value: Status; label: string; variant?: "ghost" | "destructive" }>> = {
  accepted: [
    { value: "in_progress", label: "Mark in progress" },
    { value: "cancelled", label: "Cancel", variant: "ghost" }
  ],
  in_progress: [
    { value: "delivered", label: "Mark delivered" },
    { value: "cancelled", label: "Cancel", variant: "ghost" }
  ],
  delivered: [
    { value: "closed", label: "Mark closed" }
  ]
};

export function AdminStatusButtons({
  ticketId,
  currentStatus
}: {
  ticketId: string;
  currentStatus: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const options = NEXT_OPTIONS[currentStatus] ?? [];

  function onClick(next: Status) {
    setError(null);
    startTransition(async () => {
      const result = await updateWorkOrderStatus({ id: ticketId, status: next });
      if (!result.ok) setError(result.error);
    });
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No transitions available from <code>{currentStatus}</code>.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.value}
            variant={o.variant ?? "default"}
            size="sm"
            onClick={() => onClick(o.value)}
            disabled={pending}
          >
            {o.label}
          </Button>
        ))}
      </div>
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
