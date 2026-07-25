"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  ArrowRight,
  GitCommitHorizontal,
  GitPullRequest,
  Tag,
  ExternalLink,
  Linkedin,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import { useMotionProps, FADE_UP, FADE } from "@/hooks/use-motion-props";
import {
  FOUNDER,
  TYPEWRITER_PHRASES,
  SHIPPED_WORK,
} from "@/lib/jeremy-data";
import type { GitHubEvent } from "@/app/api/github-activity/route";

// ---------------------------------------------------------------------------
// Typewriter hook
// ---------------------------------------------------------------------------
function useTypewriter(
  phrases: readonly string[],
  typingSpeed = 52,
  pauseMs = 2400,
  paused = false
) {
  const [display, setDisplay] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
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
// ActivityTicker — pulls from /api/github-activity, cycles every 4 s
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

  // ⚡ Bolt: Pause auto-advance when off-screen to prevent unnecessary re-renders
  useEffect(() => {
    if (events.length < 2 || !isInView) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % events.length), 4000);
    return () => clearInterval(t);
  }, [events, isInView]);

  return (
    <div ref={ref} className="flex min-h-[30px] w-full max-w-full items-center justify-center">
      {events.length > 0 && (() => {
        const ev = events[idx];
        return (
          <Link
            href={ev.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-full border border-border/60 bg-elevated/80 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all duration-200 max-w-full"
            aria-label={`Latest activity: ${ev.message} in ${ev.repo}`}
          >
            <span className="text-primary/70 flex-shrink-0">{EVENT_ICONS[ev.type]}</span>
            <span className="font-mono text-[11px] text-primary/80 flex-shrink-0 hidden sm:inline">
              {ev.repo}
            </span>
            <span className="hidden sm:inline text-border/60" aria-hidden="true">/</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={ev.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="truncate"
              >
                {ev.message}
              </motion.span>
            </AnimatePresence>
            <span className="ml-auto flex-shrink-0 opacity-50 hidden sm:inline">
              {timeAgo(ev.timestamp)}
            </span>
            <ExternalLink
              className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0"
              aria-hidden="true"
            />
          </Link>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkCards — carousel of shipped projects pulled from lib/jeremy-data.ts
// ---------------------------------------------------------------------------
function WorkCards() {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  const prev = useCallback(
    () => setActive((i) => (i - 1 + SHIPPED_WORK.length) % SHIPPED_WORK.length),
    []
  );
  const next = useCallback(
    () => setActive((i) => (i + 1) % SHIPPED_WORK.length),
    []
  );

  // ⚡ Bolt: Pause auto-advance when off-screen to prevent unnecessary re-renders
  useEffect(() => {
    if (!isInView) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [next, isInView]);

  const project = SHIPPED_WORK[active];

  return (
    <div ref={ref} className="relative w-full">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-elevated/60 backdrop-blur">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {project.category}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{project.year}</span>
                </div>
                <p className="font-semibold text-sm text-foreground">{project.name}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {project.description}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {project.stack.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href={project.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label={`View ${project.name} on GitHub`}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dots + arrows */}
        <div className="flex items-center justify-between border-t border-border/40 px-3 py-2">
          <div className="flex gap-1" role="tablist" aria-label="Shipped projects">
            {SHIPPED_WORK.map((w, i) => (
              <button
                key={w.slug}
                role="tab"
                aria-selected={i === active}
                aria-label={`View ${w.name}`}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === active
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-0.5">
            <button
              onClick={prev}
              aria-label="Previous project"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ArrowRight className="h-3 w-3 rotate-180" aria-hidden="true" />
            </button>
            <button
              onClick={next}
              aria-label="Next project"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Hero
// ---------------------------------------------------------------------------
export function Hero() {
  const { open } = useLightbox();
  const mp = useMotionProps(FADE_UP);
  const mpFade = useMotionProps(FADE);

  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref);

  // ⚡ Bolt: Pause typewriter effect when off-screen to prevent unnecessary re-renders
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
      className="relative overflow-hidden pt-10 md:pt-16 pb-16 md:pb-24"
    >
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-dobeu-mesh" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-dobeu-hero" aria-hidden="true" />

      <div className="container max-w-6xl">
        {/* Activity ticker */}
        <motion.div
          initial={mp.initial}
          animate={mp.animate}
          transition={{ duration: 0.4 }}
          className="mb-8 md:mb-10 flex justify-center"
        >
          <ActivityTicker />
        </motion.div>

        {/* Split layout: avatar left / copy right */}
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-14 lg:gap-20">

          {/* ── Avatar column ── */}
          <motion.div
            initial={mpFade.initial}
            animate={mpFade.animate}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="flex-shrink-0 flex flex-col items-center gap-5"
          >
            {/* Photo */}
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-110"
                aria-hidden="true"
              />
              <div className="relative h-44 w-44 md:h-56 md:w-56 rounded-full overflow-hidden border-2 border-primary/30 shadow-2xl">
                <Image
                  src={FOUNDER.avatar}
                  alt={`${FOUNDER.name}, ${FOUNDER.title} at Dobeu`}
                  fill
                  sizes="(max-width: 768px) 176px, 224px"
                  className="object-cover object-top"
                  priority
                />
              </div>
              {/* Availability dot */}
              <span
                className="absolute bottom-3 right-3 h-4 w-4 rounded-full border-2 border-background bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.55)]"
                aria-label="Currently available"
              />
            </div>

            {/* Name + socials */}
            <div className="text-center">
              <p className="font-semibold text-foreground">{FOUNDER.name}</p>
              <p className="text-sm text-muted-foreground">{FOUNDER.title}</p>
              <div className="mt-2.5 flex items-center justify-center gap-3">
                <Link
                  href={FOUNDER.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Jeremy Williams on LinkedIn"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Linkedin className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href={FOUNDER.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Jeremy Williams on GitHub"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Github className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Work cards (desktop only, below avatar) */}
            <div className="hidden md:block w-64 lg:w-72">
              <WorkCards />
            </div>
          </motion.div>

          {/* ── Copy column ── */}
          <div className="flex-1 text-center md:text-left">
            {/* Eyebrow */}
            <motion.p
              initial={mp.initial}
              animate={mp.animate}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-sm font-medium text-primary mb-3"
            >
              {FOUNDER.location} &middot; Building since {FOUNDER.since}
            </motion.p>

            {/* Headline */}
            <h1
              id="hero-heading"
              className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]"
            >
              <motion.span
                initial={mp.initial}
                animate={mp.animate}
                transition={{ duration: 0.45, delay: 0.25 }}
                className="block text-foreground"
              >
                Hi. I&apos;m Jeremy.
              </motion.span>
              <motion.span
                initial={mp.initial}
                animate={mp.animate}
                transition={{ duration: 0.45, delay: 0.35 }}
                className="block mt-1"
              >
                I ship{" "}
                <span
                  className="gradient-text"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {typeText}
                  <span
                    className="inline-block w-[3px] h-[0.9em] bg-accent ml-0.5 align-middle animate-pulse rounded-sm"
                    aria-hidden="true"
                  />
                </span>
              </motion.span>
            </h1>

            {/* Tagline */}
            <motion.p
              initial={mp.initial}
              animate={mp.animate}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="mt-5 max-w-lg mx-auto md:mx-0 text-base md:text-lg text-muted-foreground leading-relaxed"
            >
              One operator. Modern stack. Production-grade AI agents, apps, and growth
              systems for founders who need it{" "}
              <span className="text-foreground font-medium">shipped, not pitched.</span>{" "}
              From idea to live in 2&ndash;6 weeks.
            </motion.p>

            {/* Trust strip */}
            <motion.div
              initial={mp.initial}
              animate={mp.animate}
              transition={{ duration: 0.5, delay: 0.52 }}
              className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 text-xs text-muted-foreground"
            >
              <span>Building since 2019</span>
              <span className="text-border" aria-hidden="true">&middot;</span>
              <span>NYC-based</span>
              <span className="text-border" aria-hidden="true">&middot;</span>
              <span>Stripe-verified</span>
              <span className="text-border" aria-hidden="true">&middot;</span>
              <span className="text-accent font-medium">No agency overhead</span>
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={mp.initial}
              animate={mp.animate}
              transition={{ duration: 0.5, delay: 0.58 }}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3"
            >
              <Button
                size="xl"
                onClick={() => trackAndOpen("book", "Book a call — hero")}
                className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-lg shadow-primary/20"
              >
                Book a call <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button
                size="xl"
                variant="outline"
                onClick={() => trackAndOpen("form", "Tell me about your project — hero")}
                className="w-full sm:w-auto"
              >
                Tell me about your project
              </Button>
            </motion.div>

            {/* Work cards (mobile, below CTAs) */}
            <motion.div
              initial={mp.initial}
              animate={mp.animate}
              transition={{ duration: 0.5, delay: 0.68 }}
              className="mt-8 md:hidden"
            >
              <WorkCards />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
