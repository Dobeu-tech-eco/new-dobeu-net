import type { Metadata } from "next";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Learn about Dobeu, Jeremy's projects, and ways to collaborate.",
  alternates: { canonical: "/faq" },
};

export default function FAQPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader eyebrow="FAQ" title="Frequently asked questions."
        description="A little more about the projects, the person behind them, and building together." />
      <FAQ />
      <FinalCTA />
    </MarketingShell>
  );
}
