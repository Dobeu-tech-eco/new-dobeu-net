"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";
import { HERO_COPY } from "@/lib/jeremy-data";

export function EstimateCtas({
  location,
  estimateTestId,
}: {
  location: string;
  estimateTestId?: string;
}) {
  const { open } = useLightbox();

  function trackAndOpen(target: "book" | "form", label: string) {
    track("cta_click", { cta_label: label, cta_location: location, target });
    open(target);
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <Button
        size="lg"
        onClick={() => trackAndOpen("book", `Book a call — ${location}`)}
        className="group rounded-full font-semibold"
      >
        {HERO_COPY.bookCta}
        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Button>
      <Button
        size="lg"
        variant="outline"
        onClick={() => trackAndOpen("form", `Get a price estimate — ${location}`)}
        className="rounded-full font-medium"
        data-testid={estimateTestId}
      >
        {HERO_COPY.estimateCta}
      </Button>
    </div>
  );
}
