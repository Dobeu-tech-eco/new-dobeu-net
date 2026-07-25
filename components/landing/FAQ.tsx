"use client";

import { motion } from "motion/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useMotionProps, FADE_UP } from "@/hooks/use-motion-props";

const FAQS = [
  {
    q: "What's the typical engagement size?",
    a: "Most projects land between $5k and $30k. Smaller scoped sprints exist for tight problems; multi-month builds get quoted separately. You get a fixed-scope, fixed-price proposal after the discovery call so you know the number before committing.",
  },
  {
    q: "How fast can you start?",
    a: "Usually within a week of the discovery call. If I'm fully booked I'll say so on the call and recommend someone good — never string you along.",
  },
  {
    q: "Do you do retainers?",
    a: "Occasionally — for ongoing automation work, agent maintenance, or growth engineering. The discovery call is the right place to scope this.",
  },
  {
    q: "Where will the code live?",
    a: "Your GitHub org by default. I work in feature branches with PR review, and you get full admin access on day one. No code held hostage.",
  },
  {
    q: "Do you sign NDAs?",
    a: "Yes — mutual NDA before the proposal step if you need it. Send yours or use mine.",
  },
  {
    q: "Do you take equity?",
    a: "Rarely, and only with a meaningful cash component alongside. Most engagements are cash.",
  },
  {
    q: "Will I be able to maintain what you build?",
    a: "That's the goal. Every deliverable comes with documentation, a Loom walkthrough, and a 2-week support window after handoff. Modern stack means your future hires already know it.",
  },
  {
    q: "Why \"dobeu\"?",
    a: "Two readings at once. Say it out loud — it's my last initial W, spelled phonetically (\"dub-el-u\"). It's also \"Do Be You\": we handle the technical backend so you get to focus on running your business.",
  },
];

export function FAQ() {
  const mp = useMotionProps(FADE_UP);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="py-24 md:py-32 border-t border-border/25"
    >
      <div className="container max-w-6xl">
        <div className="grid md:grid-cols-[280px_1fr] gap-10 md:gap-20 items-start">

          {/* Left: sticky header */}
          <motion.div
            initial={mp.initial}
            whileInView={mp.whileInView}
            viewport={mp.viewport}
            transition={{ duration: 0.45 }}
            className="md:sticky md:top-24"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              Questions
            </p>
            <h2
              id="faq-heading"
              className="font-display text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.05] text-balance"
            >
              Everything
              <br />
              <span className="text-muted-foreground/40">you need to know.</span>
            </h2>
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
              Still have questions? Drop me a line at{" "}
              <a
                href="mailto:jeremyw@dobeu.net"
                className="text-primary hover:underline underline-offset-4 font-medium"
              >
                jeremyw@dobeu.net
              </a>
              .
            </p>

            {/* Count pill */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="font-mono font-bold text-foreground">{FAQS.length}</span>
              questions answered
            </div>
          </motion.div>

          {/* Right: accordion */}
          <motion.div
            initial={mp.initial}
            whileInView={mp.whileInView}
            viewport={mp.viewport}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border-border/30 last:border-b-0"
                >
                  <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline py-5 gap-4 [&>svg]:shrink-0 [&>svg]:text-primary/60">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5 pr-6">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
