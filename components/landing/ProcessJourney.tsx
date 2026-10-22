"use client";

import { Check, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAutoStep } from "./ExperienceProvider";
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "Understand the work.",
    description:
      "We walk through the day-to-day with you: who does what, where things break down, and which exceptions matter. No solution before we understand the problem.",
    label: "01 / understand",
    output: "A clear operational need",
    items: [
      "Walk through the working day",
      "Identify constraints and exceptions",
      "Understand responsibilities and handoffs",
    ],
    note: "Understand first. Build second.",
  },
  {
    title: "Design the right fit.",
    description:
      "Together we define what better looks like, what the system needs to connect to, and a clear scope. Sometimes the right answer is improving what you already have.",
    label: "02 / design",
    output: "A scope that fits your operation",
    items: [
      "Define what better looks like",
      "Review existing tools and connections",
      "Agree on scope, responsibilities, and cost",
    ],
    note: "The operation sets the direction. Not the latest trend.",
  },
  {
    title: "Build it. Use it. Refine it.",
    description:
      "We develop the solution, work through real scenarios with your team, and support the handover. The goal is something people can actually rely on—not just a successful demo.",
    label: "03 / build + handover",
    output: "Ready for your working day",
    items: [
      "Work through real scenarios",
      "Document the important details",
      "Support your team through handover",
    ],
    note: "Built to be used. Built to be understood.",
  },
];

export function ProcessJourney() {
  const { ref, active, direction, select, interactionProps, playing } =
    useAutoStep(steps.length);
  const step = steps[active];
  return (
    <div
      ref={ref}
      {...interactionProps}
      className="flex flex-col gap-10 lg:flex-row lg:gap-20"
    >
      <ol className="flex flex-1 flex-col divide-y divide-border">
        {steps.map((item, index) => (
          <li key={item.title}>
            <button
              type="button"
              onClick={() => select(index)}
              aria-pressed={active === index}
              className="flex w-full items-start gap-4 rounded-md py-6 text-left"
            >
              <span
                className={cn(
                  "pt-1 font-mono text-xs",
                  active === index ? "text-primary" : "text-muted-foreground",
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col gap-3">
                <span
                  className={cn(
                    "font-display text-2xl font-extrabold transition-colors",
                    active === index
                      ? "text-fg-heading"
                      : "text-muted-foreground",
                  )}
                >
                  {item.title}
                </span>
                <span className="text-base leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div
        className="flex flex-1 flex-col gap-6 self-stretch rounded-lg border border-border bg-card p-7 md:p-10"
        aria-live="off"
      >
        <motion.div
          key={step.label}
          className="flex h-full flex-col gap-6"
          initial={
            playing ? { opacity: 0.72, y: direction > 0 ? 12 : -12 } : false
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: playing ? 0.62 : 0, ease: "easeOut" }}
        >
          <p className="font-mono text-xs text-muted-foreground">
            {step.label}
          </p>
          <h3 className="subsection-heading max-w-sm">{step.output}</h3>
          <ul className="flex flex-col gap-5 py-4">
            {step.items.map((item, itemIndex) => (
              <motion.li
                key={item}
                className="flex items-start gap-3 text-base leading-relaxed"
                initial={
                  playing ? { opacity: 0, y: direction > 0 ? 8 : -8 } : false
                }
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: playing ? 0.46 : 0,
                  delay: playing ? 0.08 + itemIndex * 0.08 : 0,
                  ease: "easeOut",
                }}
              >
                <Check
                  className="mt-1 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                {item}
              </motion.li>
            ))}
          </ul>
          <p className="mt-auto border-t border-border pt-6 text-base leading-relaxed text-muted-foreground">
            {step.note}
          </p>
          <Link
            href="/process"
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Explore our process{" "}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
