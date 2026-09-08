import type { Metadata } from "next";
import Link from "next/link";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { SHIPPED_WORK } from "@/lib/jeremy-data";
import { professionalServiceJsonLd } from "@/lib/marketing-schema";

export const metadata: Metadata = {
  title: "Case studies",
  description:
    "Attributable shipped work from public GitHub repos — name, vertical, stack, and year. No invented testimonials.",
  alternates: { canonical: "/case-studies" },
};

export default function CaseStudiesPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={professionalServiceJsonLd({
          name: "Dobeu Tech Solutions case studies",
          url: "https://dobeu.net/case-studies",
        })}
      />
      <MarketingPageHeader
        eyebrow="Case studies"
        title="Shipped work you can click through"
        description="Public repos only. No invented client names, quotes, or metric headlines."
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
                <h2 className="font-display text-xl font-extrabold tracking-tight">{item.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  {item.year} · {item.stack.join(" · ")}
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
