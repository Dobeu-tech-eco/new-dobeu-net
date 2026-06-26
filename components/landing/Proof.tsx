"use client";

import { motion } from "motion/react";

const STATS = [
  { label: "Properties built", value: "17" },
  { label: "On-time delivery", value: "100%" },
  { label: "Years shipping", value: "7+" },
  { label: "Avg. project length", value: "3 wks" },
];

const QUOTES = [
  {
    quote:
      "He shipped our internal agent in a week — what our last vendor couldn't do in three months. The portal, the docs, the handoff: all of it just worked.",
    author: "Operations Lead",
    org: "Logistics SaaS, NYC",
  },
  {
    quote:
      "Got a Figma library, working Next.js components, and a Tailwind config that all reference the same tokens. Designers and engineers stopped arguing.",
    author: "Founder",
    org: "Early-stage fintech",
  },
];

export function Proof() {
  return (
    <section aria-labelledby="proof-heading" className="py-20 md:py-28">
      <div className="container max-w-6xl">
        <h2 id="proof-heading" className="sr-only">
          Proof
        </h2>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-16">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="text-center"
            >
              <div className="font-display text-3xl md:text-5xl font-extrabold gradient-text">
                {stat.value}
              </div>
              <div className="mt-1 text-xs md:text-sm text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quotes */}
        <div className="grid md:grid-cols-2 gap-6">
          {QUOTES.map((q, i) => (
            <motion.blockquote
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-xl border border-border bg-card p-6 md:p-8"
            >
              {/* Security: Render via standard React children to prevent XSS instead of dangerouslySetInnerHTML */}
              <p className="text-base md:text-lg leading-relaxed text-foreground">
                &ldquo;{q.quote}&rdquo;
              </p>
              <footer className="mt-4 text-sm text-muted-foreground">
                — {q.author}, {q.org}
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
