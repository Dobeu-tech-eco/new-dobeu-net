"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  ArrowRight,
  GitCommitHorizontal,
  GitPullRequest,
  Tag,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import { useMotionProps, FADE_UP } from "@/hooks/use-motion-props";
import { FOUNDER, TYPEWRITER_PHRASES } from "@/lib/jeremy-data";
import type { GitHubEvent } from "@/app/api/github-activity/route";

// ---------------------------------------------------------------------------
// Typewriter hook
// ---------------------------------------------------------------------------
function useTypewriter(
  phrases: readonly string[],
  typingSpeed = 52,
  pauseMs = 2400
) {
  const [display, setDisplay] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = phrases[phraseIdx];
    let timer: ReturnType<typeof setTimeout>;

    if (!deleting && charIdx < phrase.length) {
      timer = setTimeout(() => setCharIdx((i) => i + 1), typingSpeed);
    } else if (!deleting && charIdx === phrase.length) {
      timer = setTimeout(() => setDeleting(true), pauseMs);
    } else if (deleting && charIdx > 0) {
      timer = setTimeout(() => setCharIdx((i) => i - 1), typingSpeed / 2);
    } else {
      setDeleting(false);
      setPhraseIdx((i) => (i + 1) % phrases.length);
    }

    setDisplay(phrase.slice(0, charIdx));
    return () => clearTimeout(timer);
  }, [charIdx, deleting, phraseIdx, phrases, typingSpeed, pauseMs]);

  return display;
}

// ---------------------------------------------------------------------------
// Event icon map
// ---------------------------------------------------------------------------
const EVENT_ICONS: Record<GitHubEvent["type"], React.ReactNode> = {
  push: <GitCommitHorizontal className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />,
  pr: <GitPullRequest className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />,
  release: <Tag className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />,
  star: <Tag className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />,
  other: <GitCommitHorizontal className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />,
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ---------------------------------------------------------------------------
// ActivityTicker
// ---------------------------------------------------------------------------
function ActivityTicker() {
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  useEffect(() => {
    fetch("/api/github-activity")
      .then((r) => r.json())
      .then((data: GitHubEvent[]) => setEvents(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (events.length < 2 || !isInView) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % events.length), 4000);
    return () => clearInterval(t);
  }, [events, isInView]);

  return (
    <div ref={ref} className="flex min-h-[30px] w-full max-w-full items-center justify-start">
      {events.length > 0 && (() => {
        const ev = events[idx];
        return (
          <Link
            href={ev.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full border border-border/50 bg-elevated/60 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all duration-200"
            aria-label={`Latest activity: ${ev.message} in ${ev.repo}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" aria-hidden="true" />
            <span className="font-mono text-[11px] text-primary/80 flex-shrink-0 hidden sm:inline">
              {ev.repo}
            </span>
            <span className="hidden sm:inline text-border/50" aria-hidden="true">/</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={ev.id}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.2 }}
                className="truncate max-w-[180px]"
              >
                {ev.message}
              </motion.span>
            </AnimatePresence>
            <span className="ml-1 flex-shrink-0 opacity-40 hidden sm:inline">
              {timeAgo(ev.timestamp)}
            </span>
            <ExternalLink
              className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0"
              aria-hidden="true"
            />
          </Link>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Hero
// ---------------------------------------------------------------------------
export function Hero() {
  const { open } = useLightbox();
  const mp = useMotionProps(FADE_UP);
  const typeText = useTypewriter(TYPEWRITER_PHRASES);

  function trackAndOpen(target: "book" | "form" | "email", label: string) {
    track("cta_click", { cta_label: label, cta_location: "hero", target });
    open(target);
  }

  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden pt-16 md:pt-24 pb-20 md:pb-32"
    >
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 15% 60%, hsl(var(--dobeu-violet-500)/0.10), transparent 65%), radial-gradient(ellipse 50% 40% at 90% 20%, hsl(var(--dobeu-amber-500)/0.07), transparent 55%)",
        }}
      />

      <div className="container max-w-6xl">
        {/* Eyebrow row */}
        <motion.div
          initial={mp.initial}
          animate={mp.animate}
          transition={{ duration: 0.5 }}
          className="mb-14 md:mb-16"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-8">
            <ActivityTicker />
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground shrink-0">
              <span className="hidden sm:block h-px w-8 bg-border/60" aria-hidden="true" />
              <span>{FOUNDER.location}</span>
              <span className="h-1 w-1 rounded-full bg-border/50 flex-shrink-0" aria-hidden="true" />
              <span>Since {FOUNDER.since}</span>
            </div>
          </div>

          {/* Headline */}
          <div className="max-w-4xl">
            <h1
              id="hero-heading"
              className="font-display font-extrabold tracking-tight leading-[1.02]"
            >
              <motion.span
                initial={mp.initial}
                animate={mp.animate}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="block text-4xl sm:text-5xl lg:text-[4.5rem] xl:text-[5rem] text-muted-foreground/40"
              >
                Hi. I&apos;m Jeremy.
              </motion.span>
              <motion.span
                initial={mp.initial}
                animate={mp.animate}
                transition={{ duration: 0.45, delay: 0.18 }}
                className="block text-4xl sm:text-5xl lg:text-[4.5rem] xl:text-[5rem] text-foreground"
              >
                I ship{" "}
                <span
                  className="text-primary"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {typeText}
                  <span
                    className="inline-block w-[3px] h-[0.85em] bg-primary ml-1 align-middle animate-pulse"
                    aria-hidden="true"
                  />
                </span>
              </motion.span>
            </h1>
          </div>
        </motion.div>

        {/* Sub-copy + CTAs */}
        <motion.p
          initial={mp.initial}
          animate={mp.animate}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl"
        >
          One operator. Modern stack. Production-grade AI agents, apps, and
          growth systems for founders who need it{" "}
          <span className="text-foreground font-semibold">shipped, not pitched.</span>{" "}
          From idea to live in 2–6 weeks.
        </motion.p>

        {/* Trust strip */}
        <motion.div
          initial={mp.initial}
          animate={mp.animate}
          transition={{ duration: 0.5, delay: 0.42 }}
          className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"
        >
          {[
            "Building since 2019",
            "NYC-based",
            "Stripe-verified",
          ].map((item, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && (
                <span className="h-1 w-1 rounded-full bg-border/60 flex-shrink-0" aria-hidden="true" />
              )}
              {item}
            </span>
          ))}
          <span className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-border/60 flex-shrink-0" aria-hidden="true" />
            <span className="text-accent font-semibold">No agency overhead</span>
          </span>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={mp.initial}
          animate={mp.animate}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <Button
            size="lg"
            onClick={() => trackAndOpen("book", "Book a call — hero")}
            className="group w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-7 shadow-amber-glow/20"
          >
            Book a call
            <ArrowRight
              className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => trackAndOpen("form", "Tell me about your project — hero")}
            className="w-full sm:w-auto rounded-full font-medium px-7"
          >
            Tell me about your project
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
