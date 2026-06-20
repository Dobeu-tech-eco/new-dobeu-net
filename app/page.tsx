import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { Services } from "@/components/landing/Services";
import { SubBrandsStrip } from "@/components/landing/SubBrandsStrip";
import { LightboxProvider } from "@/components/landing/LightboxProvider";

const HowItWorks = dynamic(() =>
  import("@/components/landing/HowItWorks").then((m) => m.HowItWorks)
);
const Founder = dynamic(() => import("@/components/landing/Founder").then((m) => m.Founder));
const FAQ = dynamic(() => import("@/components/landing/FAQ").then((m) => m.FAQ));
const FinalCTA = dynamic(() => import("@/components/landing/FinalCTA").then((m) => m.FinalCTA));
const StickyMobileCTA = dynamic(() =>
  import("@/components/landing/StickyMobileCTA").then((m) => m.StickyMobileCTA)
);

export const metadata: Metadata = {
  title: "Jeremy Williams — AI Agents, Full-Stack Apps & Brand Systems | Dobeu",
  description:
    "Solo founder. Modern stack. Production-grade AI agents, apps, and growth systems — shipped in 2–6 weeks, no agency overhead. NYC-based, building since 2019.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="flex flex-col">
        <Hero />
        <SubBrandsStrip />
        <Services />
        <HowItWorks />
        <Founder />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
      <StickyMobileCTA />
    </LightboxProvider>
  );
}
