import { describe, expect, it } from "vitest";
import {
  approvedMetrics,
  DEAD_HOSTS,
  FOOTER_SITE_LINKS,
  FOUNDER_STATS,
  getServicePillar,
  getShippedWork,
  HAS_ATTRIBUTABLE_CASE_STUDIES,
  GTM_PILLARS,
  HERO_COPY,
  LEAD_REPLY_SLA,
  MARKETING_FAQS,
  PIPELINE,
  PRICING_TIERS,
  ORGANIZATION_SAME_AS,
  PERSON_SAME_AS,
  PRICE_RANGE,
  PRIMARY_NAV_LINKS,
  resolveTypeformFormId,
  SHIPPED_WORK,
  SHOW_LABS_HERO_CTA,
  SITE_IDENTITY,
  SUB_BRANDS,
  TYPEFORM_PUBLIC_FORM_ID,
  TYPEWRITER_PHRASES,
} from "./jeremy-data";

function flattenPublicStrings(): string {
  return JSON.stringify({
    SITE_IDENTITY,
    SUB_BRANDS,
    FOOTER_SITE_LINKS,
    PRIMARY_NAV_LINKS,
    PERSON_SAME_AS,
    ORGANIZATION_SAME_AS,
    FOUNDER_STATS,
  });
}

describe("jeremy-data marketing source", () => {
  it("defaults Typeform to the review-first budget form", () => {
    expect(TYPEFORM_PUBLIC_FORM_ID).toBe("wKVKIBe7");
    expect(resolveTypeformFormId(undefined)).toBe("wKVKIBe7");
    expect(resolveTypeformFormId("")).toBe("wKVKIBe7");
    expect(resolveTypeformFormId("  other  ")).toBe("other");
  });

  it("keeps labs hero CTA off unless explicitly enabled", () => {
    expect(SHOW_LABS_HERO_CTA).toBe(false);
  });

  it("uses a fleet-partnership H1, not an AI-automation slogan", () => {
    expect(HERO_COPY.outcome).toBe("Partnership on the fleet job.");
    expect(HERO_COPY.outcome.toLowerCase()).not.toMatch(/ai agent|ai automation|autonomous/);
    expect(HERO_COPY.greeting).toMatch(/Jeremy\.$/);
    expect(HERO_COPY.diagnostic.toLowerCase()).toContain("not a form-filling dev shop");
    expect(HERO_COPY.promise.toLowerCase()).toContain("trucks");
    expect(PRICE_RANGE.line).toMatch(/\$5k/);
    expect(PRICE_RANGE.line).toMatch(/\$30k/);
    expect(TYPEWRITER_PHRASES.join(" ")).not.toMatch(/autonomous|ai agent|ai automation/i);
    expect(HERO_COPY.estimateCta).toBe("Send the job");
    expect(LEAD_REPLY_SLA).toBe("reply about the job within 24 hours");
    expect(LEAD_REPLY_SLA.toLowerCase()).not.toContain("price band");
  });

  it("teases RouteReady without a URL", () => {
    expect(PIPELINE.eyebrow).toMatch(/pipeline/i);
    expect(PIPELINE.name).toBe("RouteReady");
    expect(PIPELINE.lede.toLowerCase()).toContain("owners");
    expect(PIPELINE.body.toLowerCase()).toContain("not generally launched");
    const blob = JSON.stringify(PIPELINE);
    expect(blob).not.toMatch(/https?:\/\//i);
    expect(blob.toLowerCase()).not.toMatch(/routeready[a-z0-9.-]*\.(com|net|io|app)/);
    expect(blob.toLowerCase()).not.toContain("visit routeready");
  });

  it("does not sell an AI automation service in public copy", () => {
    const blob = JSON.stringify({
      HERO_COPY,
      GTM_PILLARS,
      PIPELINE,
      MARKETING_FAQS,
      PRICING_TIERS,
      SHIPPED_WORK,
      TYPEWRITER_PHRASES,
    }).toLowerCase();
    expect(blob).not.toMatch(/ai agent|ai automation|autonomous|coding agent/);
    expect(blob).not.toContain("price band");
    expect(getServicePillar("ai-agents")).toBeUndefined();
    expect(getServicePillar("on-the-shift")?.headline.toLowerCase()).not.toMatch(/ai/);
  });

  it("excludes dead hosts from public chrome data", () => {
    const blob = flattenPublicStrings();
    for (const host of DEAD_HOSTS) {
      expect(blob).not.toContain(host);
    }
  });

  it("only lists live sub-brand hrefs", () => {
    expect(SUB_BRANDS.map((b) => b.name)).not.toContain("dobeu.dev");
    for (const brand of SUB_BRANDS) {
      expect(brand.href.startsWith("https://")).toBe(true);
    }
  });

  it("splits Person vs Organization sameAs", () => {
    expect(PERSON_SAME_AS).toContain("https://www.linkedin.com/in/jeremy-williams");
    expect(ORGANIZATION_SAME_AS).not.toContain("https://www.linkedin.com/in/jeremy-williams");
  });

  it("replaces the unverifiable 50+ claim", () => {
    const stats = JSON.stringify(FOUNDER_STATS);
    expect(stats).not.toContain("50+");
    expect(stats).not.toContain("Service pillars");
    expect(stats).toContain("2019");
  });

  it("does not emit approved metrics until a client signs off", () => {
    expect(HAS_ATTRIBUTABLE_CASE_STUDIES).toBe(true);
    for (const item of SHIPPED_WORK) {
      expect(approvedMetrics(item)).toEqual([]);
    }
    expect(getShippedWork("lastplate")?.name).toBe("LastPlate");
    expect(getShippedWork("missing")).toBeUndefined();
  });

  it("resolves service pillars by slug", () => {
    expect(getServicePillar("on-the-shift")?.headline).toMatch(/trucks/i);
    expect(getServicePillar("not-a-pillar")).toBeUndefined();
  });

  it("keeps Labs out of primary nav", () => {
    expect(PRIMARY_NAV_LINKS.some((link) => /labs/i.test(link.label))).toBe(false);
    expect(FOOTER_SITE_LINKS.some((link) => link.href === "/labs")).toBe(true);
  });

  it("uses NAP without an invented street address", () => {
    expect(SITE_IDENTITY.legalName).toBe("Dobeu Tech Solutions LLC");
    expect(SITE_IDENTITY.email).toBe("jeremyw@dobeu.net");
    expect(SITE_IDENTITY.areaServed).toMatch(/NYC/);
    expect(SITE_IDENTITY).not.toHaveProperty("streetAddress");
  });
});
