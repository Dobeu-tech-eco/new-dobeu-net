"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FEATURED_EXPERIMENT, LAB_DEMOS, resolveLabSatelliteLinks } from "@/lib/labs-data";
import { DemoCard } from "@/components/labs/DemoCard";
import { ExperimentSlot } from "@/components/labs/ExperimentSlot";

export function LabsPage() {
  // Literal reads only: Next.js does not inline dynamic process.env lookups.
  const satelliteLinks = resolveLabSatelliteLinks({
    NEXT_PUBLIC_SATELLITE_TUTOR_URL: process.env.NEXT_PUBLIC_SATELLITE_TUTOR_URL,
    NEXT_PUBLIC_SATELLITE_STAFFING_URL: process.env.NEXT_PUBLIC_SATELLITE_STAFFING_URL,
  });

  return (
    <div className="container max-w-4xl py-16 md:py-24">
      <header className="mb-12 md:mb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Portfolio theater</p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-balance">
          Interactive proof from shipped work
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground leading-relaxed">
          Explore a client work order, tune a visual effect, and step through a lead pipeline. Complements{" "}
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

      {satelliteLinks.length > 0 && (
        <ul className="mb-12 space-y-4" data-testid="lab-satellite-links">
          {satelliteLinks.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card p-6 font-display text-xl font-bold tracking-tight hover:bg-muted/30 transition-colors"
              >
                {link.label}
                <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <ExperimentSlot experiment={FEATURED_EXPERIMENT} />
    </div>
  );
}
