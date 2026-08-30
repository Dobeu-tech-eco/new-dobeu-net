"use client";

import { useState, useEffect, useRef, type RefObject } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Code2,
  ExternalLink,
  LineChart,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";

const HeroShaderBackground = dynamic(
  () =>
    import("@/components/landing/HeroShaderBackground").then(
      (module) => module.HeroShaderBackground,
    ),
  { ssr: false },
);

function HeroBackdrop() {
  const [loadShader, setLoadShader] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 769px)").matches) return;
    const timer = window.setTimeout(() => setLoadShader(true), 1);
    return () => window.clearTimeout(timer);
  }, []);

  if (loadShader) return <HeroShaderBackground />;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background"
      data-testid="hero-shader-background"
    >
      <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-dobeu-violet-500/15 blur-3xl dark:bg-dobeu-violet-500/20" />
      <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-dobeu-amber-500/10 blur-3xl dark:bg-dobeu-amber-500/15" />
      <div className="absolute inset-0 bg-background/35 dark:bg-background/30 md:hidden" />
      <div className="absolute inset-0 hidden md:block md:bg-gradient-to-r md:from-background/70 md:via-background/25 md:to-transparent dark:md:from-background/70 dark:md:via-background/20 dark:md:to-transparent" />
    </div>
  );
}
import { track } from "@/lib/analytics";
import {
  FOUNDER,
  HAS_ATTRIBUTABLE_CASE_STUDIES,
  HERO_CAPABILITY_CARDS,
  HERO_COPY,
  NAP,
  PRICE_RANGE,
  SHOW_LABS_HERO_CTA,
  SITE_IDENTITY,
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

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function useInViewport<T extends Element>(ref: RefObject<T | null>) {
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return isInView;
}

function ActivityTicker() {
  const [events, setEvents] = useState<GitHubEvent[]>([]);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInViewport(ref);

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
            <span className="font-mono text-[11px] text-primary flex-shrink-0 hidden sm:inline">
              {ev.repo}
            </span>
            <span className="hidden sm:inline text-border" aria-hidden="true">/</span>
            <span className="truncate max-w-[180px]">{ev.message}</span>
            <span className="ml-1 flex-shrink-0 opacity-70 hidden sm:inline">
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

  const ref = useRef<HTMLElement>(null);
  const isInView = useInViewport(ref);
  const typeText = useTypewriter(TYPEWRITER_PHRASES, 52, 2400, !isInView);
  const secondaryHref = HAS_ATTRIBUTABLE_CASE_STUDIES ? "/case-studies" : "/pricing";

  function trackAndOpen(target: "book" | "form" | "email", label: string) {
    track("cta_click", { cta_label: label, cta_location: "hero", target });
    open(target);
  }

  return (
    <section
      ref={ref}
      id="top"
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[min(92vh,900px)] flex-col justify-center overflow-hidden py-20 md:py-28 pb-[calc(6rem+var(--cookie-banner-offset,0px))]"
    >
      <HeroBackdrop />

      <div className="container relative z-10 max-w-6xl">
        {/* LCP copy is static. motion + opacity:0 delayed Lighthouse until hydration. */}
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            {SITE_IDENTITY.brandName}
          </p>

          <div className="mb-8 flex w-full flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <ActivityTicker />
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground shrink-0">
              <span className="hidden sm:block h-px w-8 bg-border" aria-hidden="true" />
              <span>{NAP.areaServed}</span>
              <span className="h-1 w-1 rounded-full bg-border flex-shrink-0" aria-hidden="true" />
              <span>Since {FOUNDER.since}</span>
            </div>
          </div>

          <h1
            id="hero-heading"
            className="font-display font-extrabold tracking-tight leading-[1.02]"
          >
            <span className="block text-4xl sm:text-5xl lg:text-[4.25rem] xl:text-[4.75rem] text-muted-foreground">
              {HERO_COPY.greeting}{" "}
            </span>
            <span className="mt-2 block text-4xl sm:text-5xl lg:text-[4.25rem] xl:text-[4.75rem] text-foreground">
              {HERO_COPY.outcome}
            </span>
          </h1>

          <p
            className="mt-4 max-w-2xl text-base md:text-lg text-foreground leading-relaxed"
            aria-hidden="true"
          >
            I ship{" "}
            <span className="text-primary" data-testid="hero-typewriter">
              {typeText}
              <span
                className="inline-block w-[3px] h-[0.85em] bg-primary ml-1 align-middle animate-pulse"
                aria-hidden="true"
              />
            </span>
          </p>

          <p
            className="mt-6 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed"
            data-testid="hero-diagnostic"
          >
            {HERO_COPY.diagnostic}
          </p>

          <ul
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
                    className="group flex h-full w-full flex-col items-start rounded-2xl border border-border bg-card/70 p-4 text-left shadow-sm backdrop-blur transition-all duration-200 hover:border-primary/35 hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </ul>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {["Building since 2019", NAP.areaServed, "Stripe-verified"].map((item, i) => (
              <span key={item} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="h-1 w-1 rounded-full bg-border flex-shrink-0" aria-hidden="true" />
                )}
                {item}
              </span>
            ))}
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-border flex-shrink-0" aria-hidden="true" />
              <span className="text-accent font-semibold">No agency overhead</span>
            </span>
          </div>

          <p
            className="mt-5 text-sm font-medium text-foreground"
            data-testid="hero-price-line"
          >
            <button
              type="button"
              onClick={() => trackAndOpen("form", "Price line — hero")}
              className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {PRICE_RANGE.line} · {HERO_COPY.estimateCta}
            </button>
          </p>

          <div className="mt-9 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={() => trackAndOpen("book", "Book a call — hero")}
              className="group w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-7 shadow-amber-glow/20"
            >
              {HERO_COPY.bookCta}
              <ArrowRight
                className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => trackAndOpen("form", "Get a price estimate — hero")}
              className="w-full sm:w-auto rounded-full font-medium px-7"
              data-testid="hero-estimate-cta"
            >
              {HERO_COPY.estimateCta}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              asChild
              className="w-full sm:w-auto rounded-full font-medium px-7 text-foreground"
            >
              <Link href={secondaryHref}>
                {HAS_ATTRIBUTABLE_CASE_STUDIES ? "See shipped work" : "View pricing"}
              </Link>
            </Button>
            {SHOW_LABS_HERO_CTA && (
              <Button
                size="lg"
                variant="ghost"
                asChild
                className="w-full sm:w-auto rounded-full font-medium px-7"
              >
                <Link href="/labs">Explore the lab →</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
