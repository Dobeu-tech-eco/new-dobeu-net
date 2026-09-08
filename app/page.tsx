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
  title: "AI Automation & Custom Software for Small Business | NYC & NJ | Dobeu",
  description:
    `Vertical AI ops for logistics, fleet, and food service in ${NAP.areaServed}. Typical engagement ${PRICE_RANGE.display}. Book a call or get a price estimate.`,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <MarketingShell stickyCta>
      <JsonLd data={professionalServiceJsonLd()} />
      <Hero />
      <SubBrandsStrip />
      <Services />
      <HowItWorks />
      <Founder />
      <FAQ />
      <FinalCTA />
    </MarketingShell>
  );
}
