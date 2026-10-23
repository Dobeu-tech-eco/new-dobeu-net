import type { Metadata } from "next";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { NAP } from "@/lib/jeremy-data";

export const metadata: Metadata = {
  title: "Building together",
  description: `Share an idea, find common ground, and decide what to make together with Jeremy Williams at ${NAP.brandName}.`,
  alternates: { canonical: "/process" },
};

export default function ProcessPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Building together"
        title="Good work starts with shared interest."
        description="Tell me what you care about, explore where our ideas meet, and decide together what would be useful to build."
      />
      <HowItWorks variant="standalone" />
      <FinalCTA />
    </MarketingShell>
  );
}
