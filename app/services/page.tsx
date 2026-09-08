import type { Metadata } from "next";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { Services } from "@/components/landing/Services";
import { NAP, PRICE_RANGE } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

export const metadata: Metadata = {
  title: "Services",
  description: `AI agents, full-stack apps, brand systems, and growth engineering for operators in ${NAP.areaServed}. Typical engagement ${PRICE_RANGE.display}.`,
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={professionalServiceJsonLd({
          name: `${NAP.brandName} services`,
          url: `${NAP.url}/services`,
        })}
      />
      <MarketingPageHeader
        eyebrow="Services"
        title="What I ship for operators"
        description={`Four pillars. Most engagements blend a few. Typical range ${PRICE_RANGE.display} after a scoped proposal.`}
      />
      <Services variant="standalone" />
      <FinalCTA />
    </MarketingShell>
  );
}
