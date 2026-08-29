"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  ArrowRight,
  Bot,
  Code2,
  ExternalLink,
  GitCommitHorizontal,
  GitPullRequest,
  LineChart,
  Palette,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroShaderBackground } from "@/components/landing/HeroShaderBackground";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import { useMotionProps, FADE_UP } from "@/hooks/use-motion-props";
import {
  FOUNDER,
  HERO_CAPABILITY_CARDS,
  SHOW_LABS_HERO_CTA,
  TYPEWRITER_PHRASES,
} from "@/lib/jeremy-data";
import type { GitHubEvent } from "@/app/api/github-activity/route";

const CAPABILITY_ICONS = {
  Bot,
  Code2,
  Palette,
  LineChart,
} as const;

function useTypewriter(
  phrases: readonly string[],
  typingSpeed = 52,
  pauseMs = 2400,
  paused = false,
) {
  const [display, setDisplay] = useState(phrases[0] ?? "");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(phrases[0]?.length ?? 0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (paused) return;
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
  }, [charIdx, deleting, phraseIdx, phrases, typingSpeed, pauseMs, paused]);

  return display;
}

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
    <div
      ref={ref}
      className="flex min-h-[30px] w-full max-w-full items-center justify-center"
      data-testid="hero-activity-ticker"
    >
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

function scrollToService(serviceId: string) {
  document.getElementById(`service-${serviceId}`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export function Hero() {
  const { open } = useLightbox();
  const mp = useMotionProps(FADE_UP);

  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref);
  const typeText = useTypewriter(TYPEWRITER_PHRASES, 52, 2400, !isInView);

  function trackAndOpen(target: "book" | "form" | "email", label: string) {
    track("cta_click", { cta_label: label, cta_location: "hero", target });
    open(target);
  }

  return (
    <section
      ref={ref}
      id="top"
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[min(92vh,900px)] flex-col justify-center overflow-hidden py-20 md:py-28"
    >
      <HeroShaderBackground />

      <div className="container relative z-10 max-w-6xl">
        <motion.div
          initial={mp.initial}
          animate={mp.animate}
          transition={{ duration: 0.5 }}
          className="mx-auto flex max-w-4xl flex-col items-center text-center"
        >
          <div className="mb-8 flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <ActivityTicker />
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground shrink-0">
              <span className="hidden sm:block h-px w-8 bg-border/60" aria-hidden="true" />
              <span>{FOUNDER.location}</span>
              <span className="h-1 w-1 rounded-full bg-border/50 flex-shrink-0" aria-hidden="true" />
              <span>Since {FOUNDER.since}</span>
            </div>
          </div>

          <h1
            id="hero-heading"
            className="font-display font-extrabold tracking-tight leading-[1.02] text-balance"
          >
            <span className="block text-4xl sm:text-5xl lg:text-[4.25rem] xl:text-[4.75rem] text-muted-foreground/45">
              Hi. I&apos;m Jeremy.
            </span>
            <span className="mt-2 block text-4xl sm:text-5xl lg:text-[4.25rem] xl:text-[4.75rem] text-foreground">
              I ship{" "}
              <span className="text-primary" aria-live="polite" aria-atomic="true" data-testid="hero-typewriter">
                {typeText}
                <span
                  className="inline-block w-[3px] h-[0.85em] bg-primary ml-1 align-middle animate-pulse"
                  aria-hidden="true"
                />
              </span>
            </span>
          </h1>

          <motion.p
            initial={mp.initial}
            animate={mp.animate}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed"
          >
            One operator. Modern stack. Production-grade AI agents, apps, and growth systems for
            founders who need it{" "}
            <span className="text-foreground font-semibold">shipped, not pitched.</span> From idea
            to live in 2–6 weeks.
          </motion.p>

          <motion.ul
            initial={mp.initial}
            animate={mp.animate}
            transition={{ duration: 0.55, delay: 0.28 }}
            className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Core capabilities"
          >
            {HERO_CAPABILITY_CARDS.map((card) => {
              const Icon = CAPABILITY_ICONS[card.icon];
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => scrollToService(card.id)}
                    className="group flex h-full w-full flex-col items-start rounded-2xl border border-border/50 bg-card/70 p-4 text-left shadow-sm backdrop-blur transition-all duration-200 hover:border-primary/35 hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/16">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="font-display text-sm font-bold tracking-tight text-foreground">
                      {card.label}
                    </span>
                    <span className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {card.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>

          <motion.div
            initial={mp.initial}
            animate={mp.animate}
            transition={{ duration: 0.5, delay: 0.36 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground"
          >
            {["Building since 2019", "NYC-based", "Stripe-verified"].map((item, i) => (
              <span key={item} className="flex items-center gap-2">
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

          <motion.div
            initial={mp.initial}
            animate={mp.animate}
            transition={{ duration: 0.5, delay: 0.44 }}
            className="mt-9 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center"
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
            {SHOW_LABS_HERO_CTA && (
              <Button
                size="lg"
                variant="outline"
                asChild
                className="w-full sm:w-auto rounded-full font-medium px-7"
              >
                <Link href="/labs">Explore the lab →</Link>
              </Button>
            )}
            <Button
              size="lg"
              variant="ghost"
              onClick={() => trackAndOpen("form", "Tell me about your project — hero")}
              className="w-full sm:w-auto rounded-full font-medium px-7 text-muted-foreground hover:text-foreground"
            >
              Tell me about your project
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
