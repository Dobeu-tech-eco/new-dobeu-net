import type { Metadata } from "next";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Founder } from "@/components/landing/Founder";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { FOUNDER, NAP } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

export const metadata: Metadata = {
  title: "About",
  description: `${FOUNDER.name}, ${FOUNDER.title} at ${NAP.brandName}. One operator shipping AI ops for ${NAP.areaServed}.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={professionalServiceJsonLd({
          name: `${NAP.brandName} — about`,
          url: `${NAP.url}/about`,
        })}
      />
      <MarketingPageHeader
        eyebrow="About"
        title="One operator. Your stack."
        description={`${FOUNDER.name} runs ${NAP.brandName} from ${NAP.locality}. No account bench — you talk to the person who ships.`}
      />
      <Founder variant="standalone" />
      <FinalCTA />
    </MarketingShell>
  );
}
