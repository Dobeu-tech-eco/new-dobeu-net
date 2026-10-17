import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { RouteReadyShowcase, OperationalOutcomes, OperationalApproach, OperationsQuestions, OperationsContact } from "@/components/landing/OperationsHome";
import { NAP } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

export const metadata: Metadata = {
  title: "Custom Operations Software for Your Business | Dobeu",
  description: `Custom operational software built around your people and processes. Serving ${NAP.areaServed}. See RouteReady, our driver-training product, and discuss a tailored solution for your business.`,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <MarketingShell>
      <JsonLd data={professionalServiceJsonLd()} />
      <Hero />
      <RouteReadyShowcase />
      <OperationalOutcomes />
      <OperationalApproach />
      <OperationsQuestions />
      <OperationsContact
        heading={
          <h2 id="contact-heading" className="section-heading max-w-4xl">
            You know what&apos;s not working.
            <br />
            <span className="text-primary">
              Let&apos;s work out what would.
            </span>
          </h2>
        }
      />
    </MarketingShell>
  );
}
