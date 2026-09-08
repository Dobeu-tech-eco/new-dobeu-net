import { describe, expect, it } from "vitest";
import { getServicePillar } from "./jeremy-data";
import {
  breadcrumbListJsonLd,
  professionalServiceJsonLd,
  serviceOfferJsonLd,
} from "./marketing-schema";
import { safeJsonLdStringify } from "./utils";

describe("marketing JSON-LD builders", () => {
  it("emits ProfessionalService with NAP and price range", () => {
    const json = professionalServiceJsonLd();
    expect(json["@type"]).toBe("ProfessionalService");
    expect(json).not.toHaveProperty("@type", "Person");
    expect(json.email).toBe("jeremyw@dobeu.net");
    expect(json.areaServed).toMatch(/NYC/);
    expect(json.priceRange).toMatch(/5k/);
    expect(JSON.stringify(json)).not.toContain("dobeu.cloud");
  });

  it("emits Service + Offer with 5000-30000 priceRange", () => {
    const pillar = getServicePillar("ai-agents");
    const json = serviceOfferJsonLd(pillar, "/services/ai-agents");
    expect(json["@type"]).toBe("Service");
    expect(json.offers["@type"]).toBe("Offer");
    expect(json.offers.priceRange).toContain("5000");
    expect(json.offers.priceRange).toContain("30000");
    expect(safeJsonLdStringify(json)).not.toContain("\"@type\":\"Person\"");
  });

  it("emits BreadcrumbList for nested commercial routes", () => {
    const json = breadcrumbListJsonLd([
      { name: "Home", path: "/" },
      { name: "Services", path: "/services" },
      { name: "AI agents", path: "/services/ai-agents" },
    ]);
    expect(json["@type"]).toBe("BreadcrumbList");
    expect(json.itemListElement).toHaveLength(3);
    expect(json.itemListElement[2]?.item).toMatch(/\/services\/ai-agents$/);
  });
});
