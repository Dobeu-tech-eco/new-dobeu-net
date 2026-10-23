"use client";

import { ArrowDown, ArrowUpRight } from "lucide-react";
import { AnimatedSphere } from "./AnimatedSphere";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import styles from "./hero-motion.module.css";

export function Hero() {
  const { open } = useLightbox();
  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className={`${styles.hero} border-b border-border`}
    >
      <div aria-hidden="true" className={styles.sphere}>
        <AnimatedSphere />
      </div>
      <div aria-hidden="true" className={styles.grid}>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className={`${styles.content} container py-20 md:py-28 lg:py-32`}>
        <div className="flex flex-col items-start gap-8 md:gap-12">
          <p
            className={`${styles.eyebrow} flex items-center gap-3 font-mono text-xs text-muted-foreground md:text-sm`}
          >
            <span
              className="size-2 shrink-0 rounded-pill bg-dobeu-indigo-500"
              aria-hidden="true"
            />
            Jeremy Williams · Passion projects & collaboration.
          </p>
          <h1
            id="hero-heading"
            className={`${styles.headline} max-w-5xl text-balance font-display text-5xl font-bold leading-[1.2] tracking-normal text-fg-heading md:text-7xl lg:text-8xl`}
          >
            We build usable <br />
            <span className="text-primary">business technology.</span>
          </h1>
          <div
            className={`${styles.details} flex w-full flex-col gap-8 lg:flex-row lg:items-end lg:justify-between`}
          >
            <p
              data-testid="hero-promise"
              className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl"
            >
              I’m Jeremy. Dobeu is the home for my passion projects, useful
              experiments, and ideas worth exploring with like-minded people.
            </p>
            <div className="flex max-w-full flex-col items-start gap-3 lg:max-w-sm">
              <Button
                size="lg"
                className="h-auto min-h-14 max-w-full whitespace-normal rounded-pill px-6 py-4 text-left"
                data-testid="hero-estimate-cta"
                onClick={() => {
                  track("cta_click", {
                    cta_location: "hero",
                    cta_label: "Explore a collaboration",
                    target: "form",
                  });
                  open("form");
                }}
              >
                Explore a collaboration{" "}
                <ArrowUpRight
                  className="ml-2 size-4 shrink-0"
                  aria-hidden="true"
                />
              </Button>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Have a shared interest or an idea? Let’s connect.
              </p>
            </div>
          </div>
          <div
            className={`${styles.cue} flex w-full flex-col gap-6 border-t border-border pt-6`}
          >
            <ul
              aria-label="What we build around"
              className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs text-muted-foreground"
            >
              {[
                "Passion projects",
                "Shared curiosity",
                "Useful products",
                "Built together",
              ].map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
            <a
              href="#routeready"
              className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              See what that looks like{" "}
              <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
