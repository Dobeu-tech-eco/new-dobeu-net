"use client";

import { motion } from "motion/react";
import { useMotionProps, FADE_UP } from "@/hooks/use-motion-props";
import { PIPELINE } from "@/lib/jeremy-data";

export function Pipeline() {
  const mp = useMotionProps(FADE_UP);

  return (
    <section
      id="pipeline"
      aria-labelledby="pipeline-heading"
      className="scroll-mt-20 py-24 md:py-32"
    >
      <div className="container max-w-6xl">
        <motion.div
          initial={mp.initial}
          whileInView={mp.whileInView}
          viewport={mp.viewport}
          transition={{ duration: 0.45 }}
          className="rounded-2xl border border-border/30 bg-card/50 px-8 py-14 md:px-16 md:py-20"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-5">
            {PIPELINE.eyebrow}
          </p>
          <h2
            id="pipeline-heading"
            className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.04] text-balance"
          >
            {PIPELINE.name}
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-[1.4fr_0.8fr] md:gap-16">
            <div className="space-y-4 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              <p>{PIPELINE.lede}</p>
              <p>{PIPELINE.body}</p>
            </div>
            <p className="text-sm md:text-base text-foreground leading-relaxed md:pt-1">
              {PIPELINE.aside}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
