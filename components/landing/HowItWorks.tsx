"use client";

import { motion } from "motion/react";
import { CalendarCheck, FileText, Rocket } from "lucide-react";
import { useMotionProps, FADE_UP_LG } from "@/hooks/use-motion-props";

const STEPS = [
  {
    num: "01",
    icon: CalendarCheck,
    label: "30-min discovery",
    body: "We talk through what you're trying to ship, what's in the way, and whether I'm the right person. No pitch, no slide deck.",
  },
  {
    num: "02",
    icon: FileText,
    label: "Scoped proposal",
    body: "Within 48 hours, you get a one-pager: scope, milestones, price, timeline, what I need from you. Approve, decline, or refine.",
  },
  {
    num: "03",
    icon: Rocket,
    label: "Ship in 2–6 weeks",
    body: "Daily Loom updates, your private portal for files + invoices, async-first communication. Most projects ship in a single sprint.",
  },
];

export function HowItWorks() {
  const mp = useMotionProps(FADE_UP_LG, "-80px");

  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="py-24 md:py-32 border-y border-border/30 bg-elevated/20"
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
            Three steps.
            <br />
            <span className="text-muted-foreground/50">No theater.</span>
          </h2>
        </motion.div>

        {/* Steps — horizontal on desktop, stacked on mobile */}
        <ol className="grid md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-border/30 relative">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.label}
              initial={mp.initial}
              whileInView={mp.whileInView}
              viewport={mp.viewport}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative md:px-8 first:pl-0 last:pr-0 flex flex-col gap-5"
            >
              {/* Number + connector line (mobile only) */}
              <div className="flex items-center gap-4 md:flex-col md:items-start md:gap-0">
                <div className="flex items-center justify-between w-full md:w-auto md:mb-6">
                  {/* Step badge */}
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-primary text-primary-foreground font-bold text-sm shrink-0 shadow-amber-glow/10">
                      {i + 1}
                    </span>
                    <step.icon
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Mono step number (decorative) */}
                  <span className="font-mono text-3xl font-bold text-border/30 leading-none select-none">
                    {step.num}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div>
                <h3 className="font-display text-lg md:text-xl font-bold mb-2.5 tracking-tight">
                  {step.label}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
              </div>

              {/* Mobile connector arrow */}
              {i < STEPS.length - 1 && (
                <div
                  className="md:hidden absolute -bottom-3 left-4 h-6 w-px bg-border/50"
                  aria-hidden="true"
                />
              )}
            </motion.li>
          ))}
        </ol>

        {/* Footer note */}
        <motion.p
          initial={mp.initial}
          whileInView={mp.whileInView}
          viewport={mp.viewport}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="mt-12 md:mt-14 text-xs text-muted-foreground/60 text-center"
        >
          No long contracts. No kickoff theater. If I&apos;m booked, I&apos;ll
          tell you — and I&apos;ll recommend someone good.
        </motion.p>
      </div>
    </section>
  );
}
