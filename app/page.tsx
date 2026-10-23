import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { MarketingShell } from "@/components/landing/MarketingShell";
import {
  RouteReadyShowcase,
  ProductShowcase,
  OperationalOutcomes,
  OperationalApproach,
  OperationsQuestions,
  OperationsContact,
} from "@/components/landing/OperationsHome";
import { Founder } from "@/components/landing/Founder";

export const metadata: Metadata = {
  title: "We build usable business technology. | Dobeu",
  description:
    "Jeremy Williams’s home for passion projects and collaboration. Explore RouteReady, Chima Comics, Dobeu.space, and usable business technology.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <MarketingShell>
      <Hero />
      <RouteReadyShowcase />
      <ProductShowcase />
      <Founder />
      <OperationalOutcomes />
      <OperationalApproach />
      <OperationsQuestions />
      <OperationsContact
        heading={
          <h2 id="contact-heading" className="section-heading max-w-4xl">
            Have an idea we both care about?
            <br />
            <span className="text-primary">
              Let&apos;s build something together.
            </span>
          </h2>
        }
      />
    </MarketingShell>
  );
}
