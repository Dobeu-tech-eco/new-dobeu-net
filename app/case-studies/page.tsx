import type { Metadata } from "next";
import Link from "next/link";
import { FinalCTA } from "@/components/landing/FinalCTA";
import {
  MarketingPageHeader,
  MarketingShell,
} from "@/components/landing/MarketingShell";
import { SHIPPED_WORK } from "@/lib/jeremy-data";

export const metadata: Metadata = {
  title: "Case studies",
  description:
    "Explore RouteReady, Chima Comics, Dobeu.space, and Ikram & Co.: usable technology you can visit.",
  alternates: { canonical: "/case-studies" },
};

export default function CaseStudiesPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        eyebrow="Case studies"
        title="Technology you can use"
        description="Explore products and websites we've built. Each one links to a live destination."
      />
      <section className="container max-w-6xl pb-16">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SHIPPED_WORK.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/case-studies/${item.slug}`}
                className="block h-full rounded-2xl border border-border/40 bg-card/50 p-6 hover:border-primary/35 transition-colors"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                  {item.vertical}
                </p>
                <h2 className="font-display text-xl font-extrabold tracking-tight">
                  {item.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
                <p className="mt-4 text-xs font-semibold text-primary">
                  View project →
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <FinalCTA />
    </MarketingShell>
  );
}
