"use client";

import dynamic from "next/dynamic";

/**
 * Client-side code-split boundary for StickyMobileCTA. MarketingShell only
 * renders it when a page opts in (`stickyCta`); importing it through this slot
 * keeps its JS out of pages that never show it. SSR output is unchanged.
 */
export const StickyMobileCTASlot = dynamic(() =>
  import("@/components/landing/StickyMobileCTA").then((m) => m.StickyMobileCTA),
);
