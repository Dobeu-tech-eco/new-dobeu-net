import { getSiteUrl } from "@/lib/utils";
import {
  GTM_PILLARS,
  NAP,
  PRICE_RANGE,
  type GtmPillar,
} from "@/lib/jeremy-data";

export function professionalServiceJsonLd(opts?: {
  name?: string;
  description?: string;
  url?: string;
}) {
  const SITE_URL = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: opts?.name ?? NAP.brandName,
    legalName: NAP.legalName,
    url: opts?.url ?? SITE_URL,
    email: NAP.email,
    areaServed: NAP.areaServed,
    address: {
      "@type": "PostalAddress",
      addressLocality: NAP.locality,
      addressRegion: NAP.region,
      addressCountry: "US",
    },
    description:
      opts?.description ??
      `AI automation and custom software for small businesses in ${NAP.areaServed}. Typical engagement ${PRICE_RANGE.display}.`,
    priceRange: PRICE_RANGE.display,
  };
}

export function serviceOfferJsonLd(pillar?: GtmPillar, pagePath?: string) {
  const SITE_URL = getSiteUrl();
  const name = pillar?.headline ?? "Custom software and AI automation";
  const description =
    pillar?.description ??
    `Fixed-scope engagements from ${PRICE_RANGE.display} for operators in ${NAP.areaServed}.`;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url: pagePath ? `${SITE_URL}${pagePath}` : `${SITE_URL}/pricing`,
    provider: {
      "@type": "ProfessionalService",
      name: NAP.brandName,
      url: SITE_URL,
    },
    areaServed: NAP.areaServed,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: String(PRICE_RANGE.minUsd),
      priceRange: `${PRICE_RANGE.minUsd}-${PRICE_RANGE.maxUsd}`,
      description: PRICE_RANGE.line,
    },
  };
}

export function breadcrumbListJsonLd(
  crumbs: readonly { name: string; path: string }[],
) {
  const SITE_URL = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  };
}

export function pillarOfferPath(slug: string): string {
  return `/services/${slug}`;
}

export function allPillarSlugs(): string[] {
  return GTM_PILLARS.map((pillar) => pillar.slug);
}
