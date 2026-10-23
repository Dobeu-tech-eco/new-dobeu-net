import { describe, expect, it } from "vitest";
import {
  approvedMetrics,
  DEAD_HOSTS,
  FOOTER_SITE_LINKS,
  FOUNDER,
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

  it("uses the business technology positioning", () => {
    expect(HERO_COPY.outcome).toBe("We build usable business technology.");
    expect(HERO_COPY.greeting).toMatch(/Jeremy\.$/);
    expect(HERO_COPY.diagnostic.toLowerCase()).toContain("idea");
    expect(PRICE_RANGE.line).toMatch(/\$5k/);
    expect(PRICE_RANGE.line).toMatch(/\$30k/);
    expect(TYPEWRITER_PHRASES.join(" ")).not.toMatch(
      /\b(?:AI|agents?|consulting)\b/i,
    );
    expect(HERO_COPY.promise).toContain("products I care about");
    expect(HERO_COPY.estimateCta).toBe("Explore a collaboration");
    expect(HERO_COPY.bookCta).toBe("Meet Jeremy");
  });

  it("presents Jeremy as a person building passion projects", () => {
    expect(FOUNDER.linkedin).toBe("https://www.linkedin.com/in/jswilliamstu");
    expect(FOUNDER.bio).toContain("curiosity");
    expect(FOUNDER.bio).toContain("like-minded people");
    expect(FOUNDER.bio).not.toMatch(/\b(?:agency|consulting|AI agents?)\b/i);
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
    expect(PERSON_SAME_AS).toContain(
      "https://www.linkedin.com/in/jswilliamstu",
    );
    expect(ORGANIZATION_SAME_AS).not.toContain(
      "https://www.linkedin.com/in/jswilliamstu",
    );
  });

  it("replaces the unverifiable 50+ claim", () => {
    const stats = JSON.stringify(FOUNDER_STATS);
    expect(stats).not.toContain("50+");
    expect(stats).not.toContain("Service pillars");
    expect(stats).not.toContain("2019");
    expect(stats).toContain("RouteReady");
  });

  it("features real live destinations without invented claims", () => {
    expect(HAS_ATTRIBUTABLE_CASE_STUDIES).toBe(true);
    expect(SHIPPED_WORK.map((item) => item.href)).toEqual([
      "https://routereadyhq.com",
      "https://chimacomics.shop",
      "https://dobeu.space",
      "https://www.dobeu.store/en",
    ]);
    for (const item of SHIPPED_WORK) {
      expect(approvedMetrics(item)).toEqual([]);
      expect(item).not.toHaveProperty("year");
      expect(item).not.toHaveProperty("stack");
    }
    expect(getShippedWork("routeready")?.name).toBe("RouteReady");
    expect(getShippedWork("missing")).toBeUndefined();
  });

  it("resolves service pillars by slug", () => {
    expect(getServicePillar("business-systems")?.headline).toMatch(
      /Business systems/i,
    );
    expect(getServicePillar("ai-agents")).toBeUndefined();
    expect(getServicePillar("not-a-pillar")).toBeUndefined();
  });

  it("keeps Labs out of primary nav", () => {
    expect(PRIMARY_NAV_LINKS.some((link) => /labs/i.test(link.label))).toBe(
      false,
    );
    expect(FOOTER_SITE_LINKS.some((link) => link.href === "/labs")).toBe(true);
  });

  it("uses NAP without an invented street address", () => {
    expect(SITE_IDENTITY.legalName).toBe("Dobeu Tech Solutions LLC");
    expect(SITE_IDENTITY.email).toBe("jeremyw@dobeu.net");
    expect(SITE_IDENTITY.areaServed).toMatch(/NYC/);
    expect(SITE_IDENTITY).not.toHaveProperty("streetAddress");
  });
});
