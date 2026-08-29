"use client";

import Link from "next/link";
import { FEATURED_EXPERIMENT, LAB_DEMOS } from "@/lib/labs-data";
import { DemoCard } from "@/components/labs/DemoCard";
import { ExperimentSlot } from "@/components/labs/ExperimentSlot";

export function LabsPage() {
  return (
    <div className="container max-w-4xl py-16 md:py-24">
      <header className="mb-12 md:mb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Portfolio theater</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-balance">
          Interactive proof from shipped work
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
          Curated demos from real Dobeu projects — agent loops, visual craft, and growth pipelines. Complements{" "}
          <Link href="/repos" className="text-primary underline underline-offset-4 hover:text-primary/80">
            /repos
          </Link>{" "}
          with live interaction, not just GitHub listings.
        </p>
      </header>

      <div className="space-y-4 mb-12">
        {LAB_DEMOS.map((demo) => (
          <DemoCard key={demo.id} demo={demo} />
        ))}
      </div>

      <ExperimentSlot experiment={FEATURED_EXPERIMENT} />
    </div>
  );
}
