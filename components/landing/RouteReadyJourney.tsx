"use client";

import {
  Check,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAutoStep } from "./ExperienceProvider";
import { cn } from "@/lib/utils";

const stages = [
  {
    title: "Ride-along begins",
    detail: "The driver’s training journey starts with a ride-along.",
    icon: Users,
  },
  {
    title: "Trainer records progress",
    detail: "Training steps and trainer touchpoints stay documented.",
    icon: ClipboardCheck,
  },
  {
    title: "Manager reviews and signs",
    detail: "Manager review and sign-off are part of the process.",
    icon: ShieldCheck,
  },
  {
    title: "Training packet is ready",
    detail: "Training evidence stays with the record.",
    icon: FileCheck2,
  },
];

export function RouteReadyJourney() {
  const { ref, active, select, interactionProps } = useAutoStep(
    stages.length,
    4500,
  );
  const stage = stages[active];
  const Icon = stage.icon;
  return (
    <div
      ref={ref}
      {...interactionProps}
      className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 md:p-8"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">
          driver training journey
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {String(active + 1).padStart(2, "0")} / 04
        </span>
      </div>
      <div
        className="flex min-h-44 flex-col items-start justify-center gap-4 rounded-md border border-border bg-background p-6"
        aria-live="off"
      >
        <Icon className="size-8 text-primary" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <p className="font-display text-xl font-extrabold text-fg-heading">
            {stage.title}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {stage.detail}
          </p>
        </div>
      </div>
      <ol className="flex flex-col gap-1">
        {stages.map((item, index) => (
          <li key={item.title}>
            <button
              type="button"
              aria-pressed={active === index}
              onClick={() => select(index)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition-colors",
                active === index
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-pill border font-mono text-xs",
                  active >= index
                    ? "border-primary text-primary"
                    : "border-border",
                )}
              >
                {index < active ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              {item.title}
            </button>
          </li>
        ))}
      </ol>
      <p className="border-t border-border pt-4 font-mono text-xs leading-relaxed text-muted-foreground">
        Process illustration · not a live customer record
      </p>
    </div>
  );
}
