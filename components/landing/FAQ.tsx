"use client";

import { motion } from "motion/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MARKETING_FAQS, NAP } from "@/lib/jeremy-data";
import { safeJsonLdStringify } from "@/lib/utils";
import { useMotionProps, FADE_UP } from "@/hooks/use-motion-props";

export function FAQ() {
  const mp = useMotionProps(FADE_UP);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: MARKETING_FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-20 py-24 md:py-32 border-t border-border/25"
    >
      <div className="container max-w-6xl">
        <div className="grid md:grid-cols-[280px_1fr] gap-10 md:gap-20 items-start">

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
              <span className="text-muted-foreground">you need to know.</span>
            </h2>
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
              Still have questions? Drop me a line at{" "}
              <a
                href={`mailto:${NAP.email}`}
                className="text-primary hover:underline underline-offset-4 font-medium"
              >
                {NAP.email}
              </a>
              .
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="font-mono font-bold text-foreground">{MARKETING_FAQS.length}</span>
              questions answered
            </div>
          </motion.div>

          <motion.div
            initial={mp.initial}
            animate={mp.animate}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <Accordion type="single" collapsible className="w-full">
              {MARKETING_FAQS.map((f, i) => (
                <AccordionItem
                  key={f.q}
                  value={`item-${i}`}
                  className="border-border/30 last:border-b-0"
                >
                  <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline py-5 gap-4 [&>svg]:shrink-0 [&>svg]:text-primary">
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
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
    </section>
  );
}
