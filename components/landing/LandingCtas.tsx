"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { track } from "@/lib/analytics";

/**
 * Interactive CTAs for the landing page. Kept in a small client island so the
 * Hero and the static OperationsHome sections render as Server Components and
 * ship no hydration JS of their own.
 */
export function HeroEstimateCta() {
  const { open } = useLightbox();
  return <Button size="lg" className="h-auto shrink-0 rounded-full px-7 py-4" data-testid="hero-estimate-cta" onClick={() => { track("cta_click", { cta_location: "hero", cta_label: "Tell us what is getting in the way", target: "form" }); open("form"); }}>Tell us what&apos;s getting in the way <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>;
}

export function OperationsContactActions() {
  const { open } = useLightbox();
  return <><Button size="lg" className="h-auto rounded-full px-7 py-4" onClick={() => open("form")}>Tell us about your operation <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button><button type="button" onClick={() => open("book")} className="rounded-md text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Prefer to talk it through? Book a conversation.</button></>;
}
