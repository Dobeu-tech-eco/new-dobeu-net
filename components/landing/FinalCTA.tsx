"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";

export function FinalCTA() {
  const { open } = useLightbox();

  return (
    <section aria-labelledby="cta-heading" className="py-20 md:py-28">
      <div className="container max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-8 md:p-14 text-center"
        >
          <div className="absolute inset-0 -z-10 bg-dobeu-mesh opacity-60" aria-hidden="true" />
          <h2
            id="cta-heading"
            className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-4"
          >
            Let&apos;s build the thing.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            30 minutes. No pitch. We&apos;ll figure out together whether I&apos;m the right person to
            ship what you&apos;re trying to ship.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="xl" onClick={() => open("book")} className="w-full sm:w-auto">
              Book a call <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              size="xl"
              variant="outline"
              onClick={() => open("email")}
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
