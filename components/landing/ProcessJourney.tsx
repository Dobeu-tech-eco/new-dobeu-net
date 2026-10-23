"use client";

import { Check, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAutoStep } from "./ExperienceProvider";
import { cn } from "@/lib/utils";

const steps = [
  {
    title: "Start with a shared interest.",
    description:
      "Tell me what you care about, what you are exploring, and who it could help. Let’s find the overlap in our interests and experience.",
    label: "01 / connect",
    output: "A reason to build together",
    items: [
      "Share the idea and its purpose",
      "Bring complementary experience",
      "Find a problem we both care about",
    ],
    note: "A conversation is a good place to start.",
  },
  {
    title: "Try something small.",
    description:
      "Choose a useful first experiment together. We’ll agree on our contributions, time, ownership, and any costs before making commitments.",
    label: "02 / explore",
    output: "A manageable first step",
    items: [
      "Choose what to learn first",
      "Agree on roles and commitments",
      "Make room for honest feedback",
    ],
    note: "Start with enough to learn something useful.",
  },
  {
    title: "Build, learn, keep going.",
    description:
      "Put the idea in people’s hands, listen to what works, and decide together what comes next. A promising experiment can grow into a lasting product.",
    label: "03 / build + learn",
    output: "Something people can use",
    items: [
      "Try it in real situations",
      "Learn from the people using it",
      "Decide the next step together",
    ],
    note: "Shared curiosity, useful progress.",
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
            Explore how we could collaborate{" "}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
