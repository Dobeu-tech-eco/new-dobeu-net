"use client";

import { motion } from "motion/react";
import { Bot, Code2, Palette, LineChart, MessageCircleQuestion } from "lucide-react";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { cn } from "@/lib/utils";

const SERVICES = [
  {
    icon: Bot,
    title: "AI agents & automation",
    description:
      "Claude + Composio + MCP integrations. Workflows that take work off your plate — from triage to fulfillment.",
    tag: "Most asked for"
  },
  {
    icon: Code2,
    title: "Full-stack web apps",
    description: "Next.js, Supabase, Vercel. MVPs, internal tools, client portals. Production-grade from day one."
  },
  {
    icon: Palette,
    title: "Brand & design systems",
    description:
      "Figma libraries with Code Connect. Design tokens that round-trip through Tailwind, Framer, and Webflow."
  },
  {
    icon: LineChart,
    title: "Marketing & growth engineering",
    description: "Programmatic SEO, GA4/PostHog/Mixpanel attribution, lifecycle automation, paid-ads infra."
  }
];

export function Services() {
  const { open } = useLightbox();

  return (
    <section id="work" aria-labelledby="work-heading" className="py-20 md:py-28">
      <div className="container max-w-6xl">
        <div className="text-center mb-12 md:mb-16">
          <h2
            id="work-heading"
            className="font-display text-3xl md:text-5xl font-bold tracking-tight"
          >
            Four things, done well.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Most engagements are a mix of these. Pick what you need — I&apos;ll tell you honestly if
            it&apos;s a fit.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
          {SERVICES.map((s, i) => (
            <motion.article
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="relative group rounded-xl border border-border bg-card p-6 md:p-8 hover:border-primary/40 hover:shadow-glow transition-all"
            >
              {s.tag && (
                <span className="absolute top-4 right-4 text-[10px] uppercase tracking-wider font-bold bg-accent/15 text-accent rounded-full px-2 py-0.5">
                  {s.tag}
                </span>
              )}
              <div
                className={cn(
                  "inline-flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary mb-4 group-hover:scale-105 transition-transform"
                )}
              >
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl md:text-2xl font-semibold mb-2">{s.title}</h3>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                {s.description}
              </p>
            </motion.article>
          ))}

          {/* "Something else" tile spans full width on lg, half on sm */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.4, delay: 0.2 }}
            onClick={() => open("form")}
            className="sm:col-span-2 group rounded-xl border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 p-6 md:p-8 text-left transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-accent/15 text-accent shrink-0 group-hover:scale-105 transition-transform">
                <MessageCircleQuestion className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-xl md:text-2xl font-semibold mb-1">
                  Something else?
                </h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Got a project that doesn&apos;t fit a category? Tell me about it — I&apos;ve probably
                  shipped something close.{" "}
                  <span className="text-accent font-medium underline-offset-4 group-hover:underline">
                    Start the conversation →
                  </span>
                </p>
              </div>
            </div>
          </motion.button>
        </div>
      </div>
    </section>
  );
}
