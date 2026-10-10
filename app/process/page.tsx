import type { Metadata } from "next";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { NAP } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

export const metadata: Metadata = {
  title: "Process",
  description: `Talk through the job, get a written scope, then do the work together. How ${NAP.brandName} works with fleets in ${NAP.areaServed}.`,
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
        title="Three steps. No ticket queue."
        description="Thirty minutes on the job, a written scope, then the work itself. If I'm booked, I'll say so."
      />
      <HowItWorks variant="standalone" />
      <FinalCTA />
    </MarketingShell>
  );
}
