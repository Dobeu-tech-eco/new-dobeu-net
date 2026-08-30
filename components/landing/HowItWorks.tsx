"use client";

import { motion } from "motion/react";
import { CalendarCheck, FileText, Rocket } from "lucide-react";
import { useMotionProps, FADE_UP_LG } from "@/hooks/use-motion-props";
import { PROCESS_STEPS } from "@/lib/jeremy-data";

const ICONS = {
  CalendarCheck,
  FileText,
  Rocket,
} as const;

export function HowItWorks({ variant = "home" }: { variant?: "home" | "standalone" }) {
  const mp = useMotionProps(FADE_UP_LG, "-80px");
  const isHome = variant === "home";

  return (
    <section
      id={isHome ? "how" : undefined}
      aria-labelledby={isHome ? "how-heading" : undefined}
      className={
        isHome
          ? "scroll-mt-20 py-24 md:py-32 border-y border-border/25 bg-card/20"
          : "py-8 md:py-12"
      }
    >
      <div className="container max-w-6xl">
        {isHome && (
          <motion.div
            initial={mp.initial}
            whileInView={mp.whileInView}
            viewport={mp.viewport}
            transition={{ duration: 0.45 }}
            className="mb-14 md:mb-16"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              The process
            </p>
            <h2
              id="how-heading"
              className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.05] text-balance"
            >
              Three steps.{" "}
              <span className="text-muted-foreground">No theater.</span>
            </h2>
          </motion.div>
        )}

        <ol className="relative flex flex-col md:flex-row md:gap-0 gap-0">
          {PROCESS_STEPS.map((step, i) => {
            const Icon = ICONS[step.icon];
            return (
              <motion.li
                key={step.label}
                initial={mp.initial}
                whileInView={mp.whileInView}
                viewport={mp.viewport}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative flex-1 group"
              >
                {i < PROCESS_STEPS.length - 1 && (
                  <div
                    className="hidden md:block absolute top-[22px] left-full w-full h-px bg-border/30 -z-10"
                    style={{ width: "calc(100% - 44px)", left: "44px" }}
                    aria-hidden="true"
                  />
                )}

                {i < PROCESS_STEPS.length - 1 && (
                  <div
                    className="md:hidden absolute left-[21px] top-[44px] w-px bg-border/30"
                    style={{ height: "calc(100% - 20px)" }}
                    aria-hidden="true"
                  />
                )}

                <div className="flex md:flex-col gap-5 md:gap-6 md:pr-10 pb-10 md:pb-0 pl-0 md:pl-0">
                  <div className="flex items-center gap-3 shrink-0 md:mb-0">
                    <div className="relative z-10 flex items-center justify-center h-11 w-11 rounded-full border-2 border-primary/30 bg-background text-primary font-bold text-sm shrink-0 group-hover:border-primary/60 transition-colors duration-200">
                      {i + 1}
                    </div>
                    <Icon
                      className="h-4 w-4 text-muted-foreground md:hidden"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="flex-1 pt-0.5 md:pt-0">
                    <Icon
                      className="hidden md:block h-4 w-4 text-muted-foreground mb-4 mt-1"
                      aria-hidden="true"
                    />
                    <h3 className="font-display text-base md:text-lg font-bold mb-2 tracking-tight">
                      {step.label}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>

        <motion.p
          initial={mp.initial}
          whileInView={mp.whileInView}
          viewport={mp.viewport}
          transition={{ duration: 0.4, delay: 0.38 }}
          className="mt-14 text-xs text-muted-foreground text-center max-w-sm mx-auto leading-relaxed"
        >
          No long contracts. No kickoff theater. If I&apos;m booked, I&apos;ll
          tell you — and I&apos;ll recommend someone good.
        </motion.p>
      </div>
    </section>
  );
}
