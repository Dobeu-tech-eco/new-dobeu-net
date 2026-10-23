"use client";

import { motion } from "motion/react";
import { EstimateCtas } from "@/components/landing/EstimateCtas";
import { useMotionProps, FADE_UP } from "@/hooks/use-motion-props";

export function FinalCTA() {
  const mp = useMotionProps(FADE_UP);

  return (
    <section
      aria-labelledby="cta-heading"
      className="py-24 md:py-32 border-t border-border/25"
    >
      <div className="container max-w-6xl">
        <motion.div
          initial={mp.initial}
          whileInView={mp.whileInView}
          viewport={mp.viewport}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl border border-border/30 bg-card/50 overflow-hidden"
        >
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse 55% 50% at 0% 0%, hsl(var(--dobeu-violet-500)/0.09), transparent 60%), radial-gradient(ellipse 50% 45% at 100% 100%, hsl(var(--dobeu-amber-500)/0.10), transparent 60%)",
            }}
          />

          <div className="relative px-8 py-14 md:px-16 md:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-5">
                Build together.
              </p>

              <h2
                id="cta-heading"
                className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.04] text-balance mb-5"
              >
                Have an idea we could bring to life?
              </h2>

              <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-10 max-w-md">
                I&apos;m Jeremy. If you&apos;re building something useful and our
                interests overlap, I&apos;d like to hear about it. Start with a
                note or make time for a conversation.
              </p>

              <EstimateCtas location="final_cta" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
