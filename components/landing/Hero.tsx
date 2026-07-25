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
// WorkCards
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

  useEffect(() => {
    if (!isInView) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [next, isInView]);

  const project = SHIPPED_WORK[active];

  return (
    <div ref={ref} className="relative w-full">
      <div className="overflow-hidden rounded-xl border border-border/50 bg-elevated/50 backdrop-blur-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {project.category}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{project.year}</span>
                </div>
                <p className="font-semibold text-sm text-foreground leading-snug">{project.name}</p>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {project.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {project.stack.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground font-medium"
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

        <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5">
          <div className="flex gap-1.5" role="tablist" aria-label="Shipped projects">
            {SHIPPED_WORK.map((w, i) => (
              <button
                key={w.slug}
                role="tab"
                aria-selected={i === active}
                aria-label={`View ${w.name}`}
                onClick={() => setActive(i)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === active
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-0.5">
            <button
              onClick={prev}
              aria-label="Previous project"
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <ArrowRight className="h-3 w-3 rotate-180" aria-hidden="true" />
            </button>
            <button
              onClick={next}
              aria-label="Next project"
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
      {/* Subtle radial glow — indigo only, no gradients on fills */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 15% 60%, hsl(var(--dobeu-indigo-500)/0.09), transparent 65%), radial-gradient(ellipse 50% 40% at 90% 20%, hsl(var(--dobeu-amber-500)/0.06), transparent 55%)",
        }}
      />

      <div className="container max-w-6xl">
        {/* ── Full-width statement row ── */}
        <motion.div
          initial={mp.initial}
          animate={mp.animate}
          transition={{ duration: 0.5 }}
          className="mb-14 md:mb-18"
        >
          {/* Eyebrow row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-8">
            <ActivityTicker />
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              <span className="hidden sm:block h-px w-8 bg-border/60" aria-hidden="true" />
              <span>{FOUNDER.location}</span>
              <span className="text-border/50" aria-hidden="true">&middot;</span>
              <span>Since {FOUNDER.since}</span>
            </div>
          </div>

          {/* Headline — large, left-aligned, B2B confidence */}
          <div className="max-w-4xl">
            <h1
              id="hero-heading"
              className="font-display font-extrabold tracking-tight leading-[1.02]"
            >
              <motion.span
                initial={mp.initial}
                animate={mp.animate}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="block text-4xl sm:text-5xl lg:text-[4.5rem] xl:text-[5rem] text-muted-foreground/50"
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

        {/* ── Two-column lower row ── */}
        <div className="grid md:grid-cols-[1fr_auto] gap-10 md:gap-16 items-start">
          {/* Left: sub-copy + CTAs + typewriter */}
          <div>
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
              className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground"
            >
              {[
                "Building since 2019",
                "NYC-based",
                "Stripe-verified",
                { label: "No agency overhead", highlight: true },
              ].map((item, i) =>
                typeof item === "string" ? (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="h-0.5 w-0.5 rounded-full bg-border/60 hidden sm:inline-block" aria-hidden="true" />
                    {item}
                  </span>
                ) : (
                  <span key={i} className="flex items-center gap-1.5 text-accent font-semibold">
                    <span className="h-0.5 w-0.5 rounded-full bg-border/60 hidden sm:inline-block" aria-hidden="true" />
                    {item.label}
                  </span>
                )
              )}
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
                className="group w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-7 shadow-amber-glow/20"
              >
                Book a free call
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => trackAndOpen("form", "Tell me about your project — hero")}
                className="w-full sm:w-auto font-medium px-7"
              >
                Tell me about your project
              </Button>
            </motion.div>
          </div>

          {/* Right: Avatar + identity + work cards */}
          <motion.aside
            initial={mpFade.initial}
            animate={mpFade.animate}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col items-center gap-5 w-full md:w-72"
            aria-label="About Jeremy Williams"
          >
            {/* Avatar */}
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl overflow-hidden border border-border/50 shadow-lg">
                <Image
                  src={FOUNDER.avatar}
                  alt={`${FOUNDER.name}, ${FOUNDER.title} at Dobeu`}
                  fill
                  sizes="80px"
                  className="object-cover object-top"
                  priority
                />
              </div>
              <span
                className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.5)]"
                aria-label="Currently available"
              />
            </div>

            {/* Name + socials */}
            <div className="text-center">
              <p className="font-semibold text-sm text-foreground">{FOUNDER.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{FOUNDER.title}</p>
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

            {/* Work cards */}
            <div className="w-full">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5 text-center">
                Recent builds
              </p>
              <WorkCards />
            </div>
          </motion.aside>
        </div>

        {/* Mobile work cards */}
        <motion.div
          initial={mp.initial}
          animate={mp.animate}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8 md:hidden"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
            Recent builds
          </p>
          <WorkCards />
        </motion.div>
      </div>
    </section>
  );
}
