import type { Metadata } from "next";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Founder } from "@/components/landing/Founder";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { FOUNDER } from "@/lib/jeremy-data";

export const metadata: Metadata = {
  title: "About",
  description: `Meet ${FOUNDER.name}, the person behind Dobeu. Dobeu is the home for his passion projects.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="About"
        title={`Meet ${FOUNDER.name}.`}
        description="Dobeu is the home for my passion projects: useful technology, creative ideas, and connections with people who want to build together."
      />
      <Founder variant="standalone" />
      <FinalCTA />
    </MarketingShell>
  );
}
