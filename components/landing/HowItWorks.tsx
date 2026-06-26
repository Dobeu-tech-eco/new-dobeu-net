"use client";

import { motion } from "motion/react";
import { CalendarCheck, FileText, Rocket } from "lucide-react";
import { useMotionProps, FADE_UP_LG } from "@/hooks/use-motion-props";

const STEPS = [
  {
    icon: CalendarCheck,
    label: "30-min discovery",
    body: "We talk through what you're trying to ship, what's in the way, and whether I'm the right person. No pitch, no slide deck.",
  },
  {
    icon: FileText,
    label: "Scoped proposal",
    body: "Within 48 hours, you get a one-pager: scope, milestones, price, timeline, what I need from you. Approve, decline, or refine.",
  },
  {
    icon: Rocket,
    label: "Ship in 2–6 weeks",
    body: "Daily Loom updates, your private portal for files + invoices, async-first communication. Most projects ship in a single sprint.",
  },
];

export function HowItWorks() {
  const mp = useMotionProps(FADE_UP_LG, "-100px");

  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="py-20 md:py-28 bg-secondary/40"
    >
      <div className="container max-w-5xl">
        <div className="text-center mb-12 md:mb-16">
          <h2
            id="how-heading"
            className="font-display text-3xl md:text-5xl font-bold tracking-tight"
          >
            How it works
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Three steps. No long contracts, no kickoff theater.
          </p>
        </div>

        <ol className="grid md:grid-cols-3 gap-4 md:gap-6 relative">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.label}
              initial={mp.initial}
              whileInView={mp.whileInView}
              viewport={mp.viewport}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative rounded-xl border border-border bg-card p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold">
                  {i + 1}
                </span>
                <step.icon
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">
                {step.label}
              </h3>
              {/* Security fix: using standard rendering instead of dangerouslySetInnerHTML to prevent XSS */}
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                {step.body}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
