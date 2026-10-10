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
const HowItWorks = dynamic(() =>
  import("@/components/landing/HowItWorks").then((m) => m.HowItWorks)
);
const Founder = dynamic(() => import("@/components/landing/Founder").then((m) => m.Founder));
const FAQ = dynamic(() => import("@/components/landing/FAQ").then((m) => m.FAQ));
const FinalCTA = dynamic(() => import("@/components/landing/FinalCTA").then((m) => m.FinalCTA));

export const metadata: Metadata = {
  title: "Custom Operations Software for Small Business | Dobeu",
  description:
    `Tailored operational systems for fleets and service businesses in ${NAP.areaServed}. We learn how your business runs, then build what it actually needs. Typical engagement ${PRICE_RANGE.display}.`,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <MarketingShell stickyCta>
      <JsonLd data={professionalServiceJsonLd()} />
      <Hero />
      <Services />
      <HowItWorks />
      <Founder />
      <FAQ />
      <SubBrandsStrip />
      <FinalCTA />
    </MarketingShell>
  );
}
