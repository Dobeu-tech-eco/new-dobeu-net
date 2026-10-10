import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Hero } from "@/components/landing/Hero";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { SubBrandsStrip } from "@/components/landing/SubBrandsStrip";
import { NAP, PRICE_RANGE } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

const Services = dynamic(() =>
  import("@/components/landing/Services").then((m) => m.Services)
);
const Pipeline = dynamic(() =>
  import("@/components/landing/Pipeline").then((m) => m.Pipeline)
);
const HowItWorks = dynamic(() =>
  import("@/components/landing/HowItWorks").then((m) => m.HowItWorks)
);
const Founder = dynamic(() => import("@/components/landing/Founder").then((m) => m.Founder));
const FAQ = dynamic(() => import("@/components/landing/FAQ").then((m) => m.FAQ));
const FinalCTA = dynamic(() => import("@/components/landing/FinalCTA").then((m) => m.FinalCTA));

export const metadata: Metadata = {
  title: "Partnership on the fleet job | Dobeu",
  description:
    `Partnership on the actual fleet job in ${NAP.areaServed}. A product only if the work earns it. Typical engagement ${PRICE_RANGE.display}.`,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <MarketingShell stickyCta>
      <JsonLd data={professionalServiceJsonLd()} />
      <Hero />
      <Services />
      <Pipeline />
      <HowItWorks />
      <Founder />
      <FAQ />
      <SubBrandsStrip />
      <FinalCTA />
    </MarketingShell>
  );
}
