import type { Metadata } from "next";
import { EstimateCtas } from "@/components/landing/EstimateCtas";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { HERO_COPY, NAP, PRICE_RANGE, PRICING_TIERS } from "@/lib/jeremy-data";
import { serviceOfferJsonLd } from "@/lib/marketing-schema";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Typical engagement ${PRICE_RANGE.display} for operators in ${NAP.areaServed}. ${HERO_COPY.estimateCta} and I reply with a band — not an instant checkout.`,
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <MarketingShell>
      <JsonLd data={serviceOfferJsonLd(undefined, "/pricing")} />
      <MarketingPageHeader
        eyebrow="Pricing"
        title="Clear bands. No procurement theater."
        description={`${PRICE_RANGE.line}. ${HERO_COPY.estimateCta} and I reply with a band before we talk numbers.`}
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
            This form does not price the job or start a checkout. I read it and reply with a band.
          </p>
          <EstimateCtas location="pricing" estimateTestId="pricing-estimate-cta" />
        </div>
      </section>
    </MarketingShell>
  );
}
