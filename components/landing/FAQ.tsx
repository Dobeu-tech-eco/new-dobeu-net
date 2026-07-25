"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { safeJsonLdStringify } from "@/lib/utils";

const FAQS = [
  {
    q: "What's the typical engagement size?",
    a: "Most projects land between $5k and $30k. Smaller scoped sprints exist for tight problems; multi-month builds get quoted separately. I send a fixed-scope, fixed-price proposal after the discovery call so you know the number before committing.",
  },
  {
    q: "How fast can you start?",
    a: "Usually within a week of the discovery call. If I'm fully booked I'll say so on the call and recommend someone good — never string you along.",
  },
  {
    q: "Do you do retainers?",
    a: "Occasionally — for ongoing automation work, agent maintenance, or growth engineering. Discovery call is the right place to scope this.",
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
    a: "Two readings at once. Say it out loud — it's my last initial, W, spelled phonetically (\"dub-el-u\"). It's also \"Do Be You\": we handle the technical backend so you get to be you — focused on running your business, not wrangling your stack. The two overlapping circles in the mark are those two meanings merging, with an amber crescent at the intersection where the work happens.",
  },
];

export function FAQ() {
  // JSON-LD for AI Overviews + featured snippets
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
    <section id="faq" aria-labelledby="faq-heading" className="py-20 md:py-28">
      <div className="container max-w-3xl">
        <div className="text-center mb-12">
          <h2
            id="faq-heading"
            className="font-display text-3xl md:text-5xl font-bold tracking-tight"
          >
            FAQ
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>
                <span>{f.q}</span>
              </AccordionTrigger>
              <AccordionContent>
                <span>{f.a}</span>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
    </section>
  );
}
