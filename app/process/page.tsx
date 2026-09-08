import type { Metadata } from "next";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { NAP } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

export const metadata: Metadata = {
  title: "Process",
  description: `Discovery, a scoped proposal, then ship in 2–6 weeks. How ${NAP.brandName} works with operators in ${NAP.areaServed}.`,
  alternates: { canonical: "/process" },
};

export default function ProcessPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={professionalServiceJsonLd({
          name: `${NAP.brandName} process`,
          url: `${NAP.url}/process`,
        })}
      />
      <MarketingPageHeader
        eyebrow="Process"
        title="Three steps. No theater."
        description="A 30-minute discovery call, a one-pager within 48 hours, then a single sprint. If I'm booked, I'll say so."
      />
      <HowItWorks variant="standalone" />
      <FinalCTA />
    </MarketingShell>
  );
}
