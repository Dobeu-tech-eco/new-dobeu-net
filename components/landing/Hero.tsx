"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import styles from "./hero-motion.module.css";

export function Hero() {
  const { open } = useLightbox();
  return (
    <section id="top" aria-labelledby="hero-heading" className={`${styles.hero} border-b-2 border-primary/40 bg-background`}>
      <div aria-hidden="true" className={styles.orbit}><span className={styles.signal} /></div>
      <div className={`${styles.content} container max-w-7xl py-20 md:py-28 lg:py-32`}>
        <div className="flex flex-col items-start gap-8">
          <p className={`${styles.eyebrow} border-l-4 border-primary pl-4 font-mono text-sm font-bold uppercase tracking-widest text-foreground`}>Real operations. Purpose-built solutions.</p>
          <h1 id="hero-heading" className={`${styles.headline} max-w-5xl text-balance font-display text-5xl font-extrabold leading-[1.04] tracking-tight text-foreground md:text-7xl lg:text-8xl`}>
            Your business isn&apos;t generic.<br /><span className="text-primary">Your software shouldn&apos;t be either.</span>
          </h1>
          <div className={`${styles.details} flex w-full flex-col gap-8 lg:flex-row lg:items-end lg:justify-between`}>
            <p data-testid="hero-promise" className="max-w-2xl text-pretty text-lg leading-relaxed text-foreground/85 md:text-xl">Safer field work. Clearer handoffs. Less chasing information. We build tailored operational systems around your people, your constraints, and the work that needs to get done.</p>
            <Button size="lg" className="h-auto shrink-0 rounded-full px-7 py-4" data-testid="hero-estimate-cta" onClick={() => { track("cta_click", { cta_location: "hero", cta_label: "Tell us what is getting in the way", target: "form" }); open("form"); }}>Tell us what&apos;s getting in the way <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>
          </div>
          <a href="#routeready" className={`${styles.cue} inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline`}>See what that looks like <ArrowDown className="h-4 w-4" aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
