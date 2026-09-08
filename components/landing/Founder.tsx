"use client";

import { motion } from "motion/react";
import { Linkedin, Mail, ArrowRight } from "lucide-react";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { FOUNDER, FOUNDER_REASONS, FOUNDER_STATS, NAP, SHIPPED_WORK } from "@/lib/jeremy-data";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { useMotionProps, FADE_UP, SCALE_IN } from "@/hooks/use-motion-props";

export function Founder({ variant = "home" }: { variant?: "home" | "standalone" }) {
  const { open } = useLightbox();
  const mpUp = useMotionProps(FADE_UP);
  const mpScale = useMotionProps(SCALE_IN);
  const isHome = variant === "home";
  const shippedNames = SHIPPED_WORK.map((item) => item.name).join(", ");

  return (
    <section
      id={isHome ? "about" : undefined}
      aria-labelledby={isHome ? "about-heading" : undefined}
      className={isHome ? "scroll-mt-20 py-24 md:py-32" : "py-8 md:py-12"}
    >
      <div className="container max-w-6xl">
        {isHome && (
          <motion.p
            initial={mpUp.initial}
            whileInView={mpUp.whileInView}
            viewport={mpUp.viewport}
            transition={{ duration: 0.4 }}
            className="text-xs font-semibold uppercase tracking-widest text-primary mb-10 md:mb-12"
          >
            The operator
          </motion.p>
        )}

        <motion.div
          initial={mpUp.initial}
          whileInView={mpUp.whileInView}
          viewport={mpUp.viewport}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="flex flex-col md:flex-row md:items-end gap-8 md:gap-16 mb-14 md:mb-16 pb-10 border-b border-border/25"
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/20 px-3 py-1 text-[11px] font-semibold text-green-700 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                Available now
              </span>
            </div>
            {isHome ? (
              <h2
                id="about-heading"
                className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[0.98] text-balance"
              >
                {FOUNDER.name}
              </h2>
            ) : (
              <p className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[0.98] text-balance">
                {FOUNDER.name}
              </p>
            )}
            <p className="mt-3 text-base text-muted-foreground">{FOUNDER.title} &mdash; {NAP.areaServed}</p>

            <div className="mt-5 flex items-center gap-2.5">
              <a
                href={FOUNDER.linkedin}
                target="_blank"
                rel="noreferrer"
                aria-label="Jeremy on LinkedIn"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-elevated/50 hover:bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
                LinkedIn
              </a>
              <a
                href={`mailto:${NAP.email}`}
                aria-label="Email Jeremy"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-elevated/50 hover:bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Email
              </a>
            </div>
          </div>

          <div className="flex items-end gap-8 md:gap-10 shrink-0">
            {FOUNDER_STATS.map((s) => (
              <div key={s.label} className="text-right md:text-right">
                <p className="font-display text-3xl md:text-4xl font-extrabold text-foreground leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-[1fr_1fr] gap-12 md:gap-20">
          <motion.div
            initial={mpUp.initial}
            whileInView={mpUp.whileInView}
            viewport={mpUp.viewport}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight leading-[1.1] text-balance mb-6">
              Why one person,
              <br />
              <span className="text-muted-foreground">not an agency?</span>
            </h3>

            <p className="text-base text-muted-foreground leading-relaxed mb-6">
              I&apos;ve been shipping software since {FOUNDER.since} — for logistics operators,
              hospitality teams, and founders building things that didn&apos;t exist yet. Public
              shipped work includes {shippedNames}.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every client I take on gets my full attention. That means I turn down more
              than I accept. If I&apos;m the right person for your project, you&apos;ll know it
              by end of the discovery call.
            </p>

            <motion.div
              initial={mpScale.initial}
              whileInView={mpScale.whileInView}
              viewport={mpScale.viewport}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-10 flex items-center gap-4"
              aria-hidden="true"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl border border-border/30 bg-card/50">
                <DobeuMark className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">dobeu.net</p>
                <p className="text-[11px] text-muted-foreground">Principal engineering & AI studio</p>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={mpUp.initial}
            whileInView={mpUp.whileInView}
            viewport={mpUp.viewport}
            transition={{ duration: 0.5, delay: 0.18 }}
          >
            <div className="space-y-0 divide-y divide-border/25">
              {FOUNDER_REASONS.map((r, i) => (
                <motion.div
                  key={r.headline}
                  initial={mpUp.initial}
                  whileInView={mpUp.whileInView}
                  viewport={mpUp.viewport}
                  transition={{ duration: 0.35, delay: 0.22 + i * 0.08 }}
                  className="py-6 first:pt-0"
                >
                  <p className="font-semibold text-sm text-foreground mb-1.5 leading-snug">{r.headline}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.body}</p>
                </motion.div>
              ))}
            </div>

            <motion.button
              initial={mpUp.initial}
              whileInView={mpUp.whileInView}
              viewport={mpUp.viewport}
              transition={{ duration: 0.35, delay: 0.46 }}
              type="button"
              onClick={() => open("book")}
              className="group mt-6 flex items-center gap-2 text-sm font-semibold text-primary hover:underline underline-offset-4 transition-colors"
            >
              Book a 30-min call
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
