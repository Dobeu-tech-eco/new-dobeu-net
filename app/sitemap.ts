import type { MetadataRoute } from "next";
import { CONTENT_DATES, GTM_PILLARS, SHIPPED_WORK } from "@/lib/jeremy-data";
import { getSiteUrl } from "@/lib/utils";

function stamp(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const SITE_URL = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: stamp(CONTENT_DATES.home), changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/services`, lastModified: stamp(CONTENT_DATES.services), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: stamp(CONTENT_DATES.pricing), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/about`, lastModified: stamp(CONTENT_DATES.about), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/process`, lastModified: stamp(CONTENT_DATES.process), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/case-studies`, lastModified: stamp(CONTENT_DATES.caseStudies), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/labs`, lastModified: stamp(CONTENT_DATES.labs), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/repos`, lastModified: stamp(CONTENT_DATES.repos), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified: stamp(CONTENT_DATES.login), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: stamp(CONTENT_DATES.privacy), changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, lastModified: stamp(CONTENT_DATES.terms), changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/cookies`, lastModified: stamp(CONTENT_DATES.cookies), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/optin/sms`, lastModified: stamp(CONTENT_DATES.optinSms), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/marketing-opt-out`, lastModified: stamp(CONTENT_DATES.marketingOptOut), changeFrequency: "yearly", priority: 0.3 },
  ];

  const pillars: MetadataRoute.Sitemap = GTM_PILLARS.map((pillar) => ({
    url: `${SITE_URL}/services/${pillar.slug}`,
    lastModified: stamp(CONTENT_DATES.services),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const caseStudies: MetadataRoute.Sitemap = SHIPPED_WORK.map((item) => ({
    url: `${SITE_URL}/case-studies/${item.slug}`,
    lastModified: stamp(CONTENT_DATES.caseStudies),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...pillars, ...caseStudies];
}
