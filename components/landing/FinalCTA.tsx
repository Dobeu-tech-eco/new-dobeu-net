"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import { useMotionProps, FADE_UP } from "@/hooks/use-motion-props";

export function FinalCTA() {
  const { open } = useLightbox();
  const mp = useMotionProps(FADE_UP);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "center center"],
  });

  // Gradient intensity increases as user scrolls to this section
  const shadowOpacity = useTransform(scrollYProgress, [0, 1], [0.3, 0.8]);
  const bgOpacity = useTransform(scrollYProgress, [0, 1], [0.05, 0.15]);

  function trackAndOpen(target: "book" | "form" | "email", label: string) {
    track("cta_click", { cta_label: label, cta_location: "final_cta", target });
    open(target);
  }

  return (
    <section ref={sectionRef} aria-labelledby="cta-heading" className="py-20 md:py-28 relative">
      {/* Gradient overlay that deepens on scroll */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-2xl opacity-0"
        style={{
          opacity: shadowOpacity,
          background: "radial-gradient(circle at center, rgba(107, 92, 231, 0.1), transparent 70%)",
        }}
      />
      <div className="container max-w-4xl">
        <motion.div
          initial={mp.initial}
          whileInView={mp.whileInView}
          viewport={mp.viewport}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/25 via-card to-accent/20 p-8 md:p-14 text-center shadow-2xl hover:shadow-3xl transition-all duration-300"
        >
          {/* Multi-layer depth effect */}
          <div className="absolute inset-0 -z-20 bg-gradient-to-t from-primary/5 via-transparent to-transparent opacity-40" aria-hidden="true" />
          <div className="absolute inset-0 -z-10 bg-dobeu-mesh opacity-80" aria-hidden="true" />
          <div className="absolute -inset-0.5 -z-30 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl blur-xl" aria-hidden="true" />
          <h2
            id="cta-heading"
            className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground"
          >
            Let&apos;s build the thing.
          </h2>
          <p className="text-base md:text-lg text-foreground/70 max-w-xl mx-auto mb-8 font-medium">
            30 minutes. No pitch. We&apos;ll figure out together whether I&apos;m the right person to
            ship what you&apos;re trying to ship.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="xl"
              onClick={() => trackAndOpen("book", "Book a call")}
              className="w-full sm:w-auto"
            >
              Book a call <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              size="xl"
              variant="outline"
              onClick={() => trackAndOpen("email", "Or just send your email")}
              className="w-full sm:w-auto"
            >
              Or just send your email
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
