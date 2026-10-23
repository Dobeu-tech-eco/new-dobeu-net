import type { Metadata } from "next";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { Services } from "@/components/landing/Services";
import { NAP } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

export const metadata: Metadata = {
  title: "Services",
  description: `Explore the kinds of useful technology Jeremy builds through ${NAP.brandName}. Scoped paid builds are available when a project calls for them.`,
  alternates: { canonical: "/services" },
};

export default function ServicesPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={professionalServiceJsonLd({
          name: `${NAP.brandName} — what we build`,
          url: `${NAP.url}/services`,
        })}
      />
      <MarketingPageHeader
        eyebrow="What we build"
        title="Useful ideas, made real."
        description="These are the kinds of technology I enjoy building. If we find a fit, we can also define a scoped paid project together."
      />
      <Services variant="standalone" />
      <FinalCTA />
    </MarketingShell>
  );
}
