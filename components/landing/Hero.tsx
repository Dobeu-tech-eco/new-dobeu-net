"use client";

import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";

export function Hero() {
  const { open } = useLightbox();

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pt-12 md:pt-20 pb-16 md:pb-24"
    >
      {/* Mesh gradient backdrop */}
      <div className="absolute inset-0 -z-10 bg-dobeu-mesh" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-dobeu-hero" aria-hidden="true" />

      <div className="container max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 backdrop-blur px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          AI agents · Full-stack apps · Brand systems · Growth engineering
        </motion.div>

        <motion.h1
          id="hero-heading"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]"
        >
          Ship the agent.
          <br className="hidden sm:inline" />{" "}
          <span className="gradient-text">Ship the app.</span>
          <br className="hidden sm:inline" />{" "}
          Ship the brand.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 mx-auto max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed"
        >
          One operator. Modern stack. Production-grade work for founders who need it shipped,
          not pitched. From idea to live in 2–6 weeks.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button size="xl" onClick={() => open("book")} className="w-full sm:w-auto">
            Book a call <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button
            size="xl"
            variant="outline"
            onClick={() => open("form")}
            className="w-full sm:w-auto"
          >
            Tell me about your project
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-6 text-xs text-muted-foreground"
        >
          Building since 2019 · Based in NYC · Stripe-verified ·{" "}
          <span className="text-accent font-medium">No agency overhead</span>
        </motion.p>
      </div>
    </section>
  );
}
