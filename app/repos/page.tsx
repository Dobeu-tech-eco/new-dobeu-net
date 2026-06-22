import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";
import { ReposClient } from "./ReposClient";

export const metadata: Metadata = {
  title: "GitHub Repos",
  description: "Link a GitHub repository and get a rich preview — stats, language breakdown, topics, and more.",
  alternates: { canonical: "/repos" },
  robots: { index: true, follow: true },
};

export default function ReposPage() {
  return (
    <LightboxProvider>
      <SiteNav />
      <main id="main" className="min-h-[70vh]">
        <ReposClient />
      </main>
      <SiteFooter />
    </LightboxProvider>
  );
}
