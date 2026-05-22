"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";

/**
 * Sticky CTA bar that appears on mobile after the user scrolls past the hero.
 * Hidden on desktop (nav already shows "Book a call").
 */
export function StickyMobileCTA() {
  const { open } = useLightbox();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-40 p-3 glass border-t border-border/60 animate-fade-up"
      role="region"
      aria-label="Quick book a call"
    >
      <Button onClick={() => open("book")} size="lg" className="w-full">
        Book a call
      </Button>
    </div>
  );
}
