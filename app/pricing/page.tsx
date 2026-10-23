import type { Metadata } from "next";
import { EstimateCtas } from "@/components/landing/EstimateCtas";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { NAP, PRICE_RANGE, PRICING_TIERS } from "@/lib/jeremy-data";
import { serviceOfferJsonLd } from "@/lib/marketing-schema";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Optional scoped paid builds from ${NAP.brandName}. See typical prices and contact Jeremy to discuss whether a project fits.`,
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <MarketingShell>
      <JsonLd data={serviceOfferJsonLd(undefined, "/pricing")} />
      <MarketingPageHeader
        eyebrow="Optional paid builds"
        title="When an idea needs a scoped build."
        description={`Some collaborations become paid projects. A typical full build is ${PRICE_RANGE.display}; scope, price, and responsibilities are agreed together before work begins.`}
      />

      <section className="container max-w-6xl pb-[calc(5rem+var(--cookie-banner-offset,0px))]">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRICING_TIERS.map((tier) => (
            <li
              key={tier.id}
              className={cn(
                "rounded-2xl border bg-card/50 p-6 md:p-8",
                "featured" in tier && tier.featured
                  ? "border-primary/40"
                  : "border-border/40",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                {tier.name}
              </p>
              <p className="font-display text-2xl font-extrabold tracking-tight">
                {tier.price}
              </p>
              <p className="mt-3 text-sm text-foreground leading-relaxed">{tier.summary}</p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{tier.detail}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 max-w-xl">
          <p className="mb-4 text-sm text-muted-foreground">
            Share the idea and what you hope to make. We can discuss a paid scope if that is the right fit.
          </p>
          <EstimateCtas location="pricing" estimateTestId="pricing-estimate-cta" />
        </div>
      </section>
    </MarketingShell>
  );
}
