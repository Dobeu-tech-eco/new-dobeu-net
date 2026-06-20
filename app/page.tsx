import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { Services } from "@/components/landing/Services";
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
        <Founder />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
      <StickyMobileCTA />
    </LightboxProvider>
  );
}
