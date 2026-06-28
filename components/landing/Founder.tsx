"use client";

import { motion } from "motion/react";
import { Linkedin, ExternalLink } from "lucide-react";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { useMotionProps, SCALE_IN, FADE_UP } from "@/hooks/use-motion-props";

const REASONS = [
  "You talk to the person doing the work — no account managers between you and the build.",
  "Decisions get made in hours, not weeks. No agency layers, no rebrand committees.",
  "Modern stack from day one. Nothing you'll have to rewrite in 18 months.",
];

export function Founder() {
  const mpScale = useMotionProps(SCALE_IN);
  const mpFadeUp = useMotionProps(FADE_UP);

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="py-20 md:py-28 bg-secondary/40"
    >
      <div className="container max-w-5xl">
        <div className="grid md:grid-cols-[1fr_2fr] gap-8 md:gap-12 items-start">
          {/* Mark + visual */}
          <motion.div
            initial={mpScale.initial}
            whileInView={mpScale.whileInView}
            viewport={mpScale.viewport}
            transition={{ duration: 0.5 }}
            className="relative aspect-square w-full max-w-[280px] mx-auto md:mx-0 rounded-2xl bg-card border border-border p-8 flex items-center justify-center shadow-glow"
          >
            <DobeuMark className="w-full h-full" />
          </motion.div>

          {/* Bio */}
          <motion.div
            initial={mpFadeUp.initial}
            whileInView={mpFadeUp.whileInView}
            viewport={mpFadeUp.viewport}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h2
              id="about-heading"
              className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4"
            >
              Why one person, not an agency?
            </h2>
            <p className="text-base md:text-lg text-muted-foreground mb-6 leading-relaxed">
              I&apos;m Jeremy Williams. I&apos;ve been shipping software since
              2019 — for logistics operators, fintechs, ops teams, and a handful
              of founders building things that didn&apos;t exist yet. Dobeu Tech
              Solutions is the practice; everything ships under it.
            </p>
            <ul className="space-y-3 mb-6">
              {REASONS.map((r) => (
                <li key={r} className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0"
                    aria-hidden="true"
                  />
                    <span className="text-sm md:text-base leading-relaxed">
                      {r}
                    </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.linkedin.com/in/jeremy-williams"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Linkedin className="h-4 w-4" /> LinkedIn
              </a>
              <a
                href="mailto:jeremyw@dobeu.net"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" /> jeremyw@dobeu.net
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
