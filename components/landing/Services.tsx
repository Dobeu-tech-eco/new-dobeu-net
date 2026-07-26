"use client";

import { motion } from "motion/react";
import { Bot, Code2, Palette, LineChart, ArrowRight, MessageSquare } from "lucide-react";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { useMotionProps, FADE_UP_LG } from "@/hooks/use-motion-props";

interface ServiceItem {
  num: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  detail: string;
  tag?: string;
}

const SERVICES: ServiceItem[] = [
  {
    num: "01",
    icon: Bot,
    title: "AI agents & automation",
    description:
      "Claude + Composio + MCP integrations. Workflows that take work off your plate — from triage to fulfillment.",
    detail: "Autonomous pipelines, tool-calling agents, LLM-powered ops.",
  },
  {
    num: "02",
    icon: Code2,
    title: "Full-stack web apps",
    description:
      "Next.js, Supabase, Vercel. MVPs, internal tools, client portals. Production-grade from day one.",
    detail: "App Router, auth, billing, CI/CD — the complete stack.",
  },
  {
    num: "03",
    icon: Palette,
    title: "Brand & design systems",
    description:
      "Figma libraries with Code Connect. Design tokens that round-trip through Tailwind, Framer, and Webflow.",
    detail: "Tokens, typography, component libraries that scale.",
    tag: "Design",
  },
  {
    num: "04",
    icon: LineChart,
    title: "Marketing & growth engineering",
    description:
      "Programmatic SEO, GA4/PostHog/Mixpanel attribution, lifecycle automation, paid-ads infra.",
    detail: "Turn traffic into pipeline — measurably.",
  },
];

export function Services() {
  const { open } = useLightbox();
  const mp = useMotionProps(FADE_UP_LG, "-80px");

  return (
    <section id="work" aria-labelledby="work-heading" className="py-24 md:py-32">
      <div className="container max-w-6xl">

        {/* Section header */}
        <motion.div
          initial={mp.initial}
          whileInView={mp.whileInView}
          viewport={mp.viewport}
          transition={{ duration: 0.45 }}
          className="mb-14 md:mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
        >
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              The Dobeu Universe
            </p>
            <h2
              id="work-heading"
              className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.05] text-balance"
            >
              Four things, done well —
              <br />
              <span className="text-muted-foreground/50">built on partnership.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
            Most engagements blend a few of these. What you&apos;re really
            hiring is a partner — not a checklist. I take on a small number of
            clients at a time, transfer everything into your hands, and stay on
            as a long-term IT advisor well past launch.
          </p>
        </motion.div>

        {/* Bento grid — 1 col mobile, 2 col sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/25 rounded-2xl overflow-hidden border border-border/25">
          {SERVICES.map((s, i) => (
            <motion.article
              key={s.title}
              initial={mp.initial}
              whileInView={mp.whileInView}
              viewport={mp.viewport}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group relative bg-background p-8 md:p-10 hover:bg-card transition-colors duration-200"
            >
              {/* Number + icon row */}
              <div className="flex items-start justify-between mb-8">
                <span className="font-mono text-[3.5rem] font-bold text-border/30 leading-none select-none tabular-nums">
                  {s.num}
                </span>
                <div className="flex items-center gap-2.5">
                  {s.tag && (
                    <span className="text-[10px] uppercase tracking-widest font-bold text-accent bg-accent/10 rounded-full px-2.5 py-0.5">
                      {s.tag}
                    </span>
                  )}
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/18 transition-colors duration-200">
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
              </div>

              {/* Copy */}
              <h3 className="font-display text-lg md:text-xl font-bold mb-3 tracking-tight text-foreground">
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {s.description}
              </p>

              {/* Detail pill */}
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary/70 tracking-wide">
                <span className="h-1 w-1 rounded-full bg-primary/50 flex-shrink-0" aria-hidden="true" />
                {s.detail}
              </p>

              {/* Hover arrow */}
              <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200" aria-hidden="true">
                <ArrowRight className="h-4 w-4 text-primary/40" />
              </div>
            </motion.article>
          ))}
        </div>

        {/* "Something else?" row */}
        <motion.div
          initial={mp.initial}
          whileInView={mp.whileInView}
          viewport={mp.viewport}
          transition={{ duration: 0.4, delay: 0.26 }}
          className="mt-4"
        >
          <button
            type="button"
            onClick={() => open("form")}
            className="group w-full rounded-2xl border border-dashed border-border/40 hover:border-primary/25 bg-transparent hover:bg-primary/[0.03] px-8 py-6 flex items-center justify-between transition-all duration-200"
            aria-label="Tell Jeremy about a project that doesn't fit a category"
          >
            <div className="flex items-center gap-4 text-left">
              <span className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-accent/10 text-accent shrink-0 group-hover:bg-accent/16 transition-colors duration-200">
                <MessageSquare className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold text-sm text-foreground">Something else?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Got a project that doesn&apos;t fit a category? I&apos;ve probably shipped something close.
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-accent shrink-0 ml-6 group-hover:underline underline-offset-4">
              Start the conversation
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </button>
        </motion.div>
      </div>
    </section>
  );
}
