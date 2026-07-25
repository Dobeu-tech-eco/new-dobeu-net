"use client";

import { motion } from "motion/react";
import { CalendarCheck, FileText, Rocket } from "lucide-react";
import { useMotionProps, FADE_UP_LG } from "@/hooks/use-motion-props";

const STEPS = [
  {
    num: "01",
    icon: CalendarCheck,
    label: "30-min discovery",
    body: "We talk through what you're trying to ship, what's in the way, and whether I'm the right person. No pitch, no slide deck — just an honest conversation.",
  },
  {
    num: "02",
    icon: FileText,
    label: "Scoped proposal",
    body: "Within 48 hours you get a one-pager: scope, milestones, price, timeline, what I need from you. Approve, decline, or refine — no obligation to that point.",
  },
  {
    num: "03",
    icon: Rocket,
    label: "Ship in 2–6 weeks",
    body: "Daily Loom updates, your private portal for files and invoices, async-first communication. Most projects ship in a single sprint with zero theater.",
  },
];

export function HowItWorks() {
  const mp = useMotionProps(FADE_UP_LG, "-80px");

  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="py-24 md:py-32 border-y border-border/25 bg-card/20"
    >
      <div className="container max-w-6xl">

        {/* Header */}
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
            <span className="text-muted-foreground/40">No theater.</span>
          </h2>
        </motion.div>

        {/* Steps — vertical rail on mobile, horizontal on desktop */}
        <ol className="relative flex flex-col md:flex-row md:gap-0 gap-0">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.label}
              initial={mp.initial}
              whileInView={mp.whileInView}
              viewport={mp.viewport}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative flex-1 group"
            >
              {/* Desktop connector line (between steps) */}
              {i < STEPS.length - 1 && (
                <div
                  className="hidden md:block absolute top-[22px] left-full w-full h-px bg-border/30 -z-10"
                  style={{ width: "calc(100% - 44px)", left: "44px" }}
                  aria-hidden="true"
                />
              )}

              {/* Mobile connector line (below each step except last) */}
              {i < STEPS.length - 1 && (
                <div
                  className="md:hidden absolute left-[21px] top-[44px] w-px bg-border/30"
                  style={{ height: "calc(100% - 20px)" }}
                  aria-hidden="true"
                />
              )}

              <div className="flex md:flex-col gap-5 md:gap-6 md:pr-10 pb-10 md:pb-0 pl-0 md:pl-0">
                {/* Step badge row */}
                <div className="flex items-center gap-3 shrink-0 md:mb-0">
                  {/* Circle with number */}
                  <div className="relative z-10 flex items-center justify-center h-11 w-11 rounded-full border-2 border-primary/30 bg-background text-primary font-bold text-sm shrink-0 group-hover:border-primary/60 transition-colors duration-200">
                    {i + 1}
                  </div>
                  <step.icon
                    className="h-4 w-4 text-muted-foreground/50 md:hidden"
                    aria-hidden="true"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5 md:pt-0">
                  {/* Icon — desktop only, below circle */}
                  <step.icon
                    className="hidden md:block h-4 w-4 text-muted-foreground/50 mb-4 mt-1"
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
          ))}
        </ol>

        {/* Footer note */}
        <motion.p
          initial={mp.initial}
          whileInView={mp.whileInView}
          viewport={mp.viewport}
          transition={{ duration: 0.4, delay: 0.38 }}
          className="mt-14 text-xs text-muted-foreground/50 text-center max-w-sm mx-auto leading-relaxed"
        >
          No long contracts. No kickoff theater. If I&apos;m booked, I&apos;ll
          tell you — and I&apos;ll recommend someone good.
        </motion.p>
      </div>
    </section>
  );
}
