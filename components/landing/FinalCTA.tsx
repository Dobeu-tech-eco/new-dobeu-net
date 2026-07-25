"use client";

import { motion } from "motion/react";
import { ArrowRight, CalendarDays, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import { useMotionProps, FADE_UP } from "@/hooks/use-motion-props";

export function FinalCTA() {
  const { open } = useLightbox();
  const mp = useMotionProps(FADE_UP);

  function trackAndOpen(target: "book" | "form" | "email", label: string) {
    track("cta_click", { cta_label: label, cta_location: "final_cta", target });
    open(target);
  }

  return (
    <section
      aria-labelledby="cta-heading"
      className="py-24 md:py-32 border-t border-border/30"
    >
      <div className="container max-w-6xl">
        <motion.div
          initial={mp.initial}
          whileInView={mp.whileInView}
          viewport={mp.viewport}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl border border-border/40 bg-elevated/40 overflow-hidden"
        >
          {/* Subtle glow — indigo top-left, amber bottom-right */}
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse 60% 55% at 5% 10%, hsl(var(--dobeu-indigo-500)/0.08), transparent 60%), radial-gradient(ellipse 45% 40% at 95% 90%, hsl(var(--dobeu-amber-500)/0.07), transparent 55%)",
            }}
          />

          <div className="relative px-8 py-14 md:px-16 md:py-20">
            <div className="max-w-2xl">
              {/* Eyebrow */}
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-5">
                Ready to ship?
              </p>

              {/* Headline */}
              <h2
                id="cta-heading"
                className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.05] text-balance mb-5"
              >
                Let&apos;s build the thing.
              </h2>

              {/* Sub-copy */}
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-10 max-w-lg">
                30 minutes. No pitch. We&apos;ll figure out together whether
                I&apos;m the right person to ship what you&apos;re trying to
                ship — and if not, I&apos;ll point you somewhere good.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  size="lg"
                  onClick={() => trackAndOpen("book", "Book a call — final CTA")}
                  className="group w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8"
                >
                  <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" />
                  Book a free call
                  <ArrowRight
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => trackAndOpen("email", "Send your email — final CTA")}
                  className="w-full sm:w-auto font-medium px-8"
                >
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                  Or just drop your email
                </Button>
              </div>
            </div>

            {/* Decorative number — top-right corner */}
            <div
              className="absolute top-8 right-8 md:top-12 md:right-14 font-mono text-[6rem] md:text-[9rem] font-bold text-border/10 leading-none select-none pointer-events-none hidden sm:block"
              aria-hidden="true"
            >
              →
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
