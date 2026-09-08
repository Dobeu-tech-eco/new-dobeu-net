import { describe, expect, it } from "vitest";
import {
  approvedMetrics,
  DEAD_HOSTS,
  FOOTER_SITE_LINKS,
  FOUNDER_STATS,
  getServicePillar,
  getShippedWork,
  HAS_ATTRIBUTABLE_CASE_STUDIES,
  HERO_COPY,
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

  it("uses an outcome H1, not a stack slogan", () => {
    expect(HERO_COPY.outcome.toLowerCase()).not.toContain("autonomous ai coding agents");
    expect(HERO_COPY.greeting).toMatch(/Jeremy\.$/);
    expect(HERO_COPY.diagnostic.toLowerCase()).toContain("spreadsheet");
    expect(PRICE_RANGE.line).toMatch(/\$5k/);
    expect(PRICE_RANGE.line).toMatch(/\$30k/);
    expect(TYPEWRITER_PHRASES.join(" ")).not.toMatch(/autonomous AI coding agents/i);
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
    expect(getServicePillar("ai-agents")?.headline).toMatch(/AI agents/i);
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
