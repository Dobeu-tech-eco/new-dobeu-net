import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EstimateCtas } from "@/components/landing/EstimateCtas";
import { JsonLd } from "@/components/landing/JsonLd";
import { MarketingPageHeader, MarketingShell } from "@/components/landing/MarketingShell";
import { GTM_PILLARS, getServicePillar, PRICE_RANGE } from "@/lib/jeremy-data";
import {
  breadcrumbListJsonLd,
  serviceOfferJsonLd,
} from "@/lib/marketing-schema";

export function generateStaticParams() {
  return GTM_PILLARS.map((pillar) => ({ pillar: pillar.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pillar: string }>;
}): Promise<Metadata> {
  const { pillar: slug } = await params;
  const pillar = getServicePillar(slug);
  if (!pillar) {
    return { title: "Service not found" };
  }
  return {
    title: pillar.headline,
    description: pillar.description,
    alternates: { canonical: `/services/${pillar.slug}` },
  };
}

export default async function ServicePillarPage({
  params,
}: {
  params: Promise<{ pillar: string }>;
}) {
  const { pillar: slug } = await params;
  const pillar = getServicePillar(slug);
  if (!pillar) notFound();

  return (
    <MarketingShell>
      <JsonLd data={serviceOfferJsonLd(pillar, `/services/${pillar.slug}`)} />
      <JsonLd
        data={breadcrumbListJsonLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          { name: pillar.headline, path: `/services/${pillar.slug}` },
        ])}
      />
      <MarketingPageHeader
        eyebrow="Service"
        title={pillar.headline}
        description={pillar.pain}
      />
      <div className="container max-w-6xl pb-16 space-y-6">
        <p className="max-w-2xl text-base text-muted-foreground leading-relaxed">
          {pillar.description}
        </p>
        <p className="text-sm font-medium text-foreground">
          {pillar.detail} · Typical range {PRICE_RANGE.display}
        </p>
        <EstimateCtas location={`services/${pillar.slug}`} />
        <p className="text-sm text-muted-foreground">
          <Link href="/services" className="underline underline-offset-4 hover:text-foreground">
            All services
          </Link>
        </p>
      </div>
    </MarketingShell>
  );
}
