"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import {
  FOUNDER,
  HERO_COPY,
  NAP,
  PRICE_RANGE,
  SHOW_LABS_HERO_CTA,
  SITE_IDENTITY,
} from "@/lib/jeremy-data";

const HeroShaderBackground = dynamic(
  () =>
    import("@/components/landing/HeroShaderBackground").then(
      (module) => module.HeroShaderBackground,
    ),
  { ssr: false },
);

function HeroBackdrop() {
  const [loadShader, setLoadShader] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 769px)").matches) return;
    const timer = window.setTimeout(() => setLoadShader(true), 1);
    return () => window.clearTimeout(timer);
  }, []);

  if (loadShader) return <HeroShaderBackground />;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background"
      data-testid="hero-shader-background"
    >
      <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-dobeu-violet-500/15 blur-3xl dark:bg-dobeu-violet-500/20" />
      <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-dobeu-amber-500/10 blur-3xl dark:bg-dobeu-amber-500/15" />
      <div className="absolute inset-0 bg-background/35 dark:bg-background/30 md:hidden" />
      <div className="absolute inset-0 hidden md:block md:bg-gradient-to-r md:from-background/70 md:via-background/25 md:to-transparent dark:md:from-background/70 dark:md:via-background/20 dark:md:to-transparent" />
    </div>
  );
}

export function Hero() {
  const { open } = useLightbox();

  function trackAndOpen(target: "book" | "form" | "email", label: string) {
    track("cta_click", { cta_label: label, cta_location: "hero", target });
    open(target);
  }

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden pt-12 md:pt-16 pb-[calc(6.5rem+var(--cookie-banner-offset,0px))]"
    >
      <HeroBackdrop />

      <div className="container relative z-10 max-w-6xl">
        {/* LCP copy is static. motion + opacity:0 delayed Lighthouse until hydration. */}
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            {SITE_IDENTITY.brandName}
          </p>

          <p className="text-sm leading-relaxed text-foreground">
            {HERO_COPY.proof}
          </p>
          <p className="mb-5 mt-2 flex items-center gap-2.5 text-xs text-muted-foreground">
            <span>{NAP.areaServed}</span>
            <span
              className="h-1 w-1 flex-shrink-0 rounded-full bg-border"
              aria-hidden="true"
            />
            <span>Since {FOUNDER.since}</span>
          </p>

          {/* Greeting is a warm intro, not a headline — the value prop owns the h1. */}
          <p className="mb-3 font-display text-lg font-semibold text-muted-foreground md:text-xl">
            {HERO_COPY.greeting}
          </p>

          <h1
            id="hero-heading"
            className="font-display font-extrabold leading-[1.02] tracking-tight"
          >
            <span className="block text-4xl text-foreground sm:text-5xl lg:text-[4.25rem] xl:text-[4.75rem]">
              {HERO_COPY.outcome}
            </span>
          </h1>

          <p
            className="mt-4 max-w-2xl text-base leading-relaxed text-foreground md:text-lg"
            data-testid="hero-promise"
          >
            {HERO_COPY.promise}
          </p>

          <p
            className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
            data-testid="hero-diagnostic"
          >
            {HERO_COPY.diagnostic}
          </p>

          <p
            className="mt-4 text-sm font-medium text-foreground"
            data-testid="hero-price-line"
          >
            {PRICE_RANGE.line}
          </p>

          <div
            id="hero-ctas"
            className="mt-5 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center"
          >
            <Button
              size="lg"
              onClick={() => trackAndOpen("book", "Book a call — hero")}
              className="group w-full rounded-full bg-primary px-7 font-semibold text-primary-foreground shadow-amber-glow/20 hover:bg-primary/90 sm:w-auto"
            >
              {HERO_COPY.bookCta}
              <ArrowRight
                className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => trackAndOpen("form", "Send the job — hero")}
              className="w-full rounded-full px-7 font-medium sm:w-auto"
              data-testid="hero-estimate-cta"
            >
              {HERO_COPY.estimateCta}
            </Button>
            {SHOW_LABS_HERO_CTA && (
              <Button
                size="lg"
                variant="ghost"
                asChild
                className="w-full rounded-full px-7 font-medium sm:w-auto"
              >
                <Link href="/labs">Explore the lab →</Link>
              </Button>
            )}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {HERO_COPY.estimateHint}
          </p>
        </div>
      </div>
    </section>
  );
}
