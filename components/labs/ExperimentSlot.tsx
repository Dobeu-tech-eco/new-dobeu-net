"use client";

import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import type { LabExperimentEntry } from "@/lib/labs-data";

export function ExperimentSlot({ experiment }: { experiment: LabExperimentEntry }) {
  const { open } = useLightbox();

  return (
    <section
      aria-labelledby="experiment-slot-heading"
      className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-6 md:p-8"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Featured experiment</p>
      <h2 id="experiment-slot-heading" className="font-display text-2xl font-extrabold tracking-tight">
        {experiment.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">{experiment.summary}</p>
      <p className="mt-3 text-xs font-medium text-muted-foreground">
        Status:{" "}
        <span className="text-foreground">{experiment.status === "live" ? "Live on site" : "Coming soon"}</span>
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-background/60 p-4">
        <p className="text-sm font-medium">Want this for your product?</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="rounded-full" onClick={() => open("book")}>
            Book a call
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => open("form")}>
            Start a project brief
          </Button>
        </div>
      </div>
    </section>
  );
}
