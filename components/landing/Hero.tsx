"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { BOOK_MICROCOPY } from "@/components/landing/EstimateCtas";
import { track } from "@/lib/analytics";
import { HERO_COPY } from "@/lib/jeremy-data";

const PROGRAM_STEPS = [
  "Ride-along starts",
  "Trainer touchpoint",
  "Manager sign-off",
  "Training packet ready",
] as const;

export function Hero() {
  const { open } = useLightbox();

  function trackAndOpen(target: "book" | "form", label: string) {
    track("cta_click", { cta_label: label, cta_location: "hero", target });
    open(target);
  }

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden border-b border-border/40 py-12 md:py-20 lg:py-24"
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-2/5 bg-card/35 lg:block" aria-hidden="true" />

      <div className="container max-w-7xl">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
          <div className="flex flex-1 flex-col items-start">
            <p className="font-display text-base font-bold text-primary md:text-lg">
              Built around the way your business actually runs.
            </p>

            <h1
              id="hero-heading"
              className="mt-5 max-w-3xl text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl"
            >
              {HERO_COPY.outcome}
            </h1>

            <p
              className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
              data-testid="hero-promise"
            >
              {HERO_COPY.promise}
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <div className="flex flex-col items-start gap-1.5">
                <Button
                  size="lg"
                  onClick={() => trackAndOpen("book", "Talk through your operation — hero")}
                  className="group w-full rounded-full px-7 font-semibold sm:w-auto"
                  aria-describedby="book-microcopy-hero"
                >
                  {HERO_COPY.bookCta}
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Button>
                <p id="book-microcopy-hero" className="text-xs text-muted-foreground">
                  {BOOK_MICROCOPY}
                </p>
              </div>
              <Button
                size="lg"
                variant="outline"
                onClick={() => trackAndOpen("form", "Tell us what is not working — hero")}
                className="w-full rounded-full px-7 font-medium sm:w-auto"
                data-testid="hero-estimate-cta"
              >
                {HERO_COPY.estimateCta}
              </Button>
            </div>

            <p className="mt-7 max-w-xl text-sm leading-relaxed text-muted-foreground">
              No off-the-shelf automation pitch. We learn the operation, find the constraint, and build the right system around your people.
            </p>
          </div>

          <div className="w-full flex-1 lg:max-w-xl">
            <article className="overflow-hidden rounded-2xl bg-elevated shadow-xl shadow-black/10" aria-label="RouteReady product example">
              <div className="flex items-center justify-between gap-4 border-b border-border/50 px-5 py-4 sm:px-6">
                <div>
                  <p className="font-display text-lg font-extrabold text-foreground">RouteReady</p>
                  <p className="text-xs text-muted-foreground">A Dobeu-built operations product</p>
                </div>
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">Live product</span>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Driver training record</p>
                    <h2 className="mt-2 text-balance font-display text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
                      Prove every driver was trained. Branch by branch.
                    </h2>
                  </div>
                  <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
                    <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-border/60 bg-background p-4">
                  <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">Marcus O.</p>
                        <p className="text-xs text-muted-foreground">10-day route program</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-success">Cleared</span>
                  </div>

                  <ol className="mt-4 flex flex-col gap-3">
                    {PROGRAM_STEPS.map((step, index) => (
                      <li key={step} className="flex items-center gap-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="flex-1 text-foreground">{step}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">Day {index === 3 ? 10 : index * 3 + 1}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileCheck2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    One trainee. One signed packet.
                  </div>
                  <Link
                    href="https://routereadyhq.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline"
                  >
                    See RouteReady
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              RouteReady was shaped around a real fleet&apos;s training program—not a generic template looking for a customer.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
