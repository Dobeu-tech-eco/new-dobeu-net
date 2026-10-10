import type { Metadata } from "next";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Founder } from "@/components/landing/Founder";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { FOUNDER, NAP } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

export const metadata: Metadata = {
  title: "About",
  description: `${FOUNDER.name}, ${FOUNDER.title} at ${NAP.brandName}. Fleet work with the people on the shift, from ${NAP.areaServed}.`,
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
        title="One operator. The actual job."
        description={`${FOUNDER.name} runs ${NAP.brandName} from ${NAP.locality}. No ticket queue — you talk to the person doing the work.`}
      />
      <Founder variant="standalone" />
      <FinalCTA />
    </MarketingShell>
  );
}
