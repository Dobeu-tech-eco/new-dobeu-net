import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { Services } from "@/components/landing/Services";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Proof } from "@/components/landing/Proof";
import { Founder } from "@/components/landing/Founder";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

export const metadata: Metadata = {
  title: "Ship the agent. Ship the app. Ship the brand.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="flex flex-col">
        <Hero />
        <Services />
        <HowItWorks />
        <Proof />
        <Founder />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
      <StickyMobileCTA />
    </LightboxProvider>
  );
}
