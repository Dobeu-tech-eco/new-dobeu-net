import type { Metadata } from "next";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LightboxProvider } from "@/components/landing/LightboxProvider";
import { ReposClient } from "./ReposClient";

export const metadata: Metadata = {
  title: "GitHub Repo Viewer — Dobeu Tools",
  description: "Paste a GitHub URL or owner/repo shorthand and instantly see stats, language breakdown, topics, and last push time.",
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
