import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";
import { LabsPage } from "@/components/labs/LabsPage";

export const metadata: Metadata = {
  title: "Labs — Interactive portfolio demos",
  description:
    "Curated interactive demos from Dobeu shipped work: AI agent loops, shader craft, and lead pipeline fan-out.",
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
