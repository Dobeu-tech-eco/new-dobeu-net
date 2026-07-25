"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Linkedin, Mail, CheckCircle2 } from "lucide-react";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { FOUNDER } from "@/lib/jeremy-data";
import { useMotionProps, FADE_UP, FADE } from "@/hooks/use-motion-props";

const REASONS = [
  {
    headline: "You talk to the person doing the work.",
    body: "No account managers between you and the build.",
  },
  {
    headline: "Decisions get made in hours, not weeks.",
    body: "No agency layers, no rebrand committees.",
  },
  {
    headline: "Modern stack from day one.",
    body: "Nothing you'll have to rewrite in 18 months.",
  },
];

export function Founder() {
  const mpFade = useMotionProps(FADE);
  const mpUp = useMotionProps(FADE_UP);

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="py-24 md:py-32"
    >
      <div className="container max-w-6xl">

        {/* Section eyebrow */}
        <motion.p
          initial={mpUp.initial}
          whileInView={mpUp.whileInView}
          viewport={mpUp.viewport}
          transition={{ duration: 0.4 }}
          className="text-xs font-semibold uppercase tracking-widest text-primary mb-10 md:mb-12"
        >
          The operator
        </motion.p>

        {/* Two-column editorial layout */}
        <div className="grid md:grid-cols-[280px_1fr] gap-10 md:gap-16 items-start">

          {/* ── Left column: photo + identity ── */}
          <motion.div
            initial={mpFade.initial}
            whileInView={mpFade.whileInView}
            viewport={mpFade.viewport}
            transition={{ duration: 0.55 }}
            className="flex flex-col items-center md:items-start gap-5"
          >
            {/* Photo */}
            <div className="relative w-52 md:w-full aspect-square rounded-2xl overflow-hidden border border-border/50">
              <Image
                src={FOUNDER.avatar}
                alt={`${FOUNDER.name}, ${FOUNDER.title}`}
                fill
                sizes="(max-width: 768px) 208px, 280px"
                className="object-cover object-top"
              />
              {/* Availability overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border/30 px-3 py-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]" aria-hidden="true" />
                <span className="text-xs font-medium text-foreground">Available now</span>
              </div>
            </div>

            {/* Identity card */}
            <div className="text-center md:text-left w-full">
              <p className="font-bold text-base text-foreground">{FOUNDER.name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{FOUNDER.title}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{FOUNDER.location} &middot; Since {FOUNDER.since}</p>

              {/* Social links */}
              <div className="mt-4 flex items-center justify-center md:justify-start gap-2">
                <a
                  href={FOUNDER.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Jeremy on LinkedIn"
                  className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-elevated/50 hover:bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
                  LinkedIn
                </a>
                <a
                  href="mailto:jeremyw@dobeu.net"
                  aria-label="Email Jeremy"
                  className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-elevated/50 hover:bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Email
                </a>
              </div>
            </div>

            {/* Dobeu mark — brand accent */}
            <div className="hidden md:flex items-center justify-center w-16 h-16 rounded-2xl border border-border/30 bg-elevated/30 mt-2">
              <DobeuMark className="w-10 h-10" />
            </div>
          </motion.div>

          {/* ── Right column: bio + why reasons ── */}
          <motion.div
            initial={mpUp.initial}
            whileInView={mpUp.whileInView}
            viewport={mpUp.viewport}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h2
              id="about-heading"
              className="font-display text-3xl md:text-4xl lg:text-[2.6rem] font-extrabold tracking-tight leading-[1.07] text-balance mb-6"
            >
              Why one person,
              <br />
              <span className="text-muted-foreground/50">not an agency?</span>
            </h2>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-10 max-w-2xl">
              I&apos;m Jeremy Williams. I&apos;ve been shipping software since 2019 —
              for logistics operators, fintechs, ops teams, and founders building things
              that didn&apos;t exist yet. Dobeu Tech Solutions is the practice; everything
              ships under it.
            </p>

            {/* Why reasons — structured */}
            <div className="space-y-6">
              {REASONS.map((r, i) => (
                <motion.div
                  key={r.headline}
                  initial={mpUp.initial}
                  whileInView={mpUp.whileInView}
                  viewport={mpUp.viewport}
                  transition={{ duration: 0.35, delay: 0.15 + i * 0.08 }}
                  className="flex gap-4"
                >
                  <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground mb-1">{r.headline}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
