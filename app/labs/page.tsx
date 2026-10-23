import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";
import { LabsPage } from "@/components/labs/LabsPage";

export const metadata: Metadata = {
  title: "Labs — Interactive portfolio demos",
  description:
    "Interactive demos of practical business workflows, visual craft, and lead capture.",
  alternates: { canonical: "/labs" },
};

export default function LabsRoutePage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main">
        <LabsPage />
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
