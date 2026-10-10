import type { Metadata } from "next";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { Services } from "@/components/landing/Services";
import { NAP, PRICE_RANGE } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

export const metadata: Metadata = {
  title: "Services",
  description: `Partnership on fleet work for operators in ${NAP.areaServed}. Typical engagement ${PRICE_RANGE.display}. Not a ticket mill.`,
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
        title="The work, not a menu of products"
        description={`Four parts of the same partnership. Most jobs blend them. Typical range ${PRICE_RANGE.display} once the job is clear.`}
      />
      <Services variant="standalone" />
      <FinalCTA />
    </MarketingShell>
  );
}
