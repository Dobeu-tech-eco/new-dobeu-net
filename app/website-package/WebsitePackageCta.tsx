"use client";

import { ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";

/**
 * Single CTA for the fixed-scope website package page.
 *
 * Deliberately opens the "book" tab, not "form" — the "form" tab is the
 * DTS Project Scope & Estimate Intake Typeform that produces a custom
 * $5k-$30k banded estimate (see lib/pricing/). Routing a $2,995 flat-price
 * buyer through that machinery would re-expose the higher band on a page
 * whose entire point is a fixed, pre-priced scope. A kickoff call is also
 * the natural first step for a fixed-price purchase decision (confirm scope
 * fits, collect intake answers, start the clock).
 */
export function WebsitePackageCta({ location }: { location: string }) {
  const { open } = useLightbox();

  function trackAndOpen() {
    track("cta_click", {
      cta_label: `Book kickoff call — ${location}`,
      cta_location: location,
      target: "book",
    });
    open("book");
  }

  return (
    <Button
      size="lg"
      onClick={trackAndOpen}
      className="group rounded-full font-semibold"
      data-testid="website-package-cta"
    >
      <CalendarDays className="mr-1 h-4 w-4" aria-hidden="true" />
      Book your kickoff call
      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Button>
  );
}
