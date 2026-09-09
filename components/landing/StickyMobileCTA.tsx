"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { HERO_COPY } from "@/lib/jeremy-data";

/**
 * Sticky CTA bar that appears on mobile after the user scrolls past the hero.
 * Hidden on desktop (nav already shows "Book a call").
 * Pads above the cookie banner via --cookie-banner-offset — never hidden
 * while consent is undecided.
 */
export function StickyMobileCTA() {
  const { open } = useLightbox();
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 600);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Publish this bar's height so other fixed chrome can sit above it, mirroring
  // how CookieBanner publishes --cookie-banner-offset. Intercom's launcher is
  // the consumer: it defaults to the bottom-right corner and would otherwise
  // land on top of the Book a call button.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const clear = () => root.style.removeProperty("--sticky-cta-offset");
    if (!visible) {
      clear();
      return;
    }
    const node = barRef.current;
    if (!node) return;
    const apply = () =>
      root.style.setProperty(
        "--sticky-cta-offset",
        `${Math.ceil(node.getBoundingClientRect().height)}px`,
      );
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => {
      observer.disconnect();
      clear();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      className="sticky-mobile-cta md:hidden fixed inset-x-0 z-40 p-3 glass border-t border-border/60 animate-fade-up"
      style={{ bottom: "var(--cookie-banner-offset, 0px)" }}
      role="region"
      aria-label="Quick book a call"
      data-testid="sticky-mobile-cta"
    >
      <Button onClick={() => open("book")} size="lg" className="w-full">
        {HERO_COPY.bookCta}
      </Button>
    </div>
  );
}
