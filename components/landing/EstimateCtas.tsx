"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import { HERO_COPY } from "@/lib/jeremy-data";

export const BOOK_MICROCOPY = "30 min, no pitch.";
export const SEND_MICROCOPY = "I reply with a price band.";

export function EstimateCtas({
  location,
  estimateTestId,
  bookTestId,
  className,
}: {
  location: string;
  estimateTestId?: string;
  bookTestId?: string;
  className?: string;
}) {
  const { open } = useLightbox();

  function trackAndOpen(target: "book" | "form", label: string) {
    track("cta_click", { cta_label: label, cta_location: location, target });
    open(target);
  }

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <Button
            size="lg"
            onClick={() => trackAndOpen("book", `Book a call — ${location}`)}
            className="group rounded-full font-semibold"
            aria-describedby={`book-microcopy-${location}`}
            data-testid={bookTestId}
          >
            {HERO_COPY.bookCta}
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Button>
          <p id={`book-microcopy-${location}`} className="text-xs text-muted-foreground">
            {BOOK_MICROCOPY}
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Button
            size="lg"
            variant="outline"
            onClick={() => trackAndOpen("form", `${HERO_COPY.estimateCta} — ${location}`)}
            className="rounded-full font-medium"
            aria-describedby={`send-microcopy-${location}`}
            data-testid={estimateTestId}
          >
            {HERO_COPY.estimateCta}
          </Button>
          <p id={`send-microcopy-${location}`} className="text-xs text-muted-foreground">
            {SEND_MICROCOPY}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{HERO_COPY.estimateHint}</p>
    </div>
  );
}
