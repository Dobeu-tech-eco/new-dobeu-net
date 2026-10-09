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
    const target = document.getElementById("hero-ctas");
    if (!target) {
      setVisible(false);
      return;
    }

    // Show only once the hero CTA row has left through the top of the viewport.
    // Hide while it intersects, and while it is still at or below the top edge.
    const apply = (top: number, intersecting: boolean) => {
      setVisible(!intersecting && top < 0);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) {
          setVisible(false);
          return;
        }
        apply(entry.boundingClientRect.top, entry.isIntersecting);
      },
      { rootMargin: "0px", threshold: 0 },
    );

    // A jump from fully above the viewport to fully below it never crosses
    // threshold 0, so IntersectionObserver will not deliver a new entry.
    // Re-read the same geometry on scroll and resize to cover that case.
    const syncFromLayout = () => {
      const rect = target.getBoundingClientRect();
      const intersecting = rect.top < window.innerHeight && rect.bottom > 0;
      apply(rect.top, intersecting);
    };

    observer.observe(target);
    syncFromLayout();
    window.addEventListener("scroll", syncFromLayout, { passive: true });
    window.addEventListener("resize", syncFromLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncFromLayout);
      window.removeEventListener("resize", syncFromLayout);
    };
  }, []);

  // Publish this bar's height so other fixed chrome can sit above it, mirroring
  // how CookieBanner publishes --cookie-banner-offset.
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
      aria-label={`${HERO_COPY.bookCta} and ${HERO_COPY.estimateCta}`}
      data-testid="sticky-mobile-cta"
    >
      <div className="flex items-center gap-2">
        <Button
          onClick={() => open("book")}
          size="lg"
          className="min-w-0 flex-1 px-3"
          aria-describedby="sticky-book-microcopy"
        >
          {HERO_COPY.bookCta}
        </Button>
        <Button
          onClick={() => open("form")}
          size="lg"
          variant="outline"
          className="min-w-0 flex-1 px-3"
          aria-describedby="sticky-send-microcopy"
        >
          {HERO_COPY.estimateCta}
        </Button>
      </div>
      <p id="sticky-book-microcopy" className="sr-only">
        30 min, no pitch.
      </p>
      <p id="sticky-send-microcopy" className="sr-only">
        I reply with a price band.
      </p>
    </div>
  );
}
