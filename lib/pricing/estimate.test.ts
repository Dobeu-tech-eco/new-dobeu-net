import { describe, expect, it } from "vitest";
import { computeEstimate, type EstimateInput } from "./estimate";
import { MINIMUM_ENGAGEMENT, RATE_CARD_VERSION, ROUNDING_INCREMENT } from "./rate-card";

/** Fixed reference date so fixed-deadline rush tiers are deterministic. */
const NOW = new Date("2026-09-01T12:00:00.000Z");

function input(overrides: Partial<EstimateInput> = {}): EstimateInput {
  return { serviceFamily: "website-build", projectStage: "new", ...overrides };
}

describe("computeEstimate — shape and invariants", () => {
  it("stamps the rate-card version so old quotes stay explainable", () => {
    expect(computeEstimate(input(), NOW).rateCardVersion).toBe(RATE_CARD_VERSION);
  });

  it("always returns low <= midpoint <= high", () => {
    const cases: readonly EstimateInput[] = [
      input(),
      input({ serviceFamily: "marketing-design", marketingDeliverables: ["brand-identity"] }),
      input({ serviceFamily: "ai-enablement", agentSurface: "customer-agent" }),
      input({ serviceFamily: "consulting", engagementType: "strategy" }),
      input({ serviceFamily: "workflow-automation", automationCount: 5 })
    ];
    for (const testCase of cases) {
      const result = computeEstimate(testCase, NOW);
      expect(result.low).toBeLessThanOrEqual(result.midpoint);
      expect(result.midpoint).toBeLessThanOrEqual(result.high);
    }
  });

  it("rounds every client-facing figure to the rounding increment", () => {
    const result = computeEstimate(
      input({ webSurface: "saas-app", pageCount: 37, roleCount: 7, integrationCount: 3 }),
      NOW
    );
    for (const amount of [result.low, result.midpoint, result.high]) {
      expect(amount % ROUNDING_INCREMENT).toBe(0);
    }
  });

  it("never quotes below the minimum engagement", () => {
    const result = computeEstimate(
      { serviceFamily: "consulting", engagementType: "training", workshopCount: 0, trainingRequired: "none" },
      NOW
    );
    expect(result.low).toBeGreaterThanOrEqual(MINIMUM_ENGAGEMENT);
  });

  it("omits line items that contribute no hours", () => {
    const result = computeEstimate(input({ webSurface: "marketing-site", authRequired: "none" }), NOW);
    expect(result.lineItems.every((entry) => entry.hours > 0)).toBe(true);
    expect(result.lineItems.some((entry) => entry.key === "web_auth")).toBe(false);
  });

  it("is pure — same input yields the same result and the input is not mutated", () => {
    const original = input({ requestedCapabilities: ["database", "reporting"] });
    const snapshot = JSON.stringify(original);
    const first = computeEstimate(original, NOW);
    const second = computeEstimate(original, NOW);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(first).toEqual(second);
  });
});

describe("computeEstimate — track selection", () => {
  it.each([
    ["website-build", "web"],
    ["website-revamp", "web"],
    ["web-application", "web"],
    ["workflow-automation", "automation"],
    ["systems-integration", "automation"],
    ["ai-enablement", "ai"],
    ["marketing-design", "marketing"],
    ["analytics", "advisory"],
    ["consulting", "advisory"],
    ["support-retainer", "advisory"]
  ])("routes %s to the %s track", (serviceFamily, track) => {
    expect(computeEstimate(input({ serviceFamily }), NOW).track).toBe(track);
  });

  it("falls back to the advisory track for an unrecognised service family", () => {
    expect(computeEstimate(input({ serviceFamily: "something-new" }), NOW).track).toBe("advisory");
  });

  it("falls back to the advisory track when the service family is missing", () => {
    expect(computeEstimate({ serviceFamily: null }, NOW).track).toBe("advisory");
  });
});

describe("computeEstimate — scope drives price", () => {
  it("prices a SaaS application above a brochure site", () => {
    const brochure = computeEstimate(input({ webSurface: "marketing-site" }), NOW);
    const saas = computeEstimate(input({ webSurface: "saas-app" }), NOW);
    expect(saas.midpoint).toBeGreaterThan(brochure.midpoint);
  });

  it("charges for pages beyond the surface's included allowance", () => {
    const included = computeEstimate(input({ webSurface: "marketing-site", pageCount: 6 }), NOW);
    const extra = computeEstimate(input({ webSurface: "marketing-site", pageCount: 26 }), NOW);
    expect(extra.midpoint).toBeGreaterThan(included.midpoint);
  });

  it("does not charge for pages below the included allowance", () => {
    const under = computeEstimate(input({ webSurface: "marketing-site", pageCount: 2 }), NOW);
    expect(under.lineItems.some((entry) => entry.key === "web_extra_pages")).toBe(false);
  });

  it("counts file uploads once when selected as both a capability and a flag", () => {
    const both = computeEstimate(
      input({ requestedCapabilities: ["file-uploads"], fileUploads: true }),
      NOW
    );
    expect(both.lineItems.some((entry) => entry.key === "web_uploads")).toBe(false);
  });

  it("charges file uploads from the flag when the capability was not selected", () => {
    const flagOnly = computeEstimate(input({ requestedCapabilities: [], fileUploads: true }), NOW);
    expect(flagOnly.lineItems.some((entry) => entry.key === "web_uploads")).toBe(true);
  });

  it("scales with integration count", () => {
    const none = computeEstimate(input({ integrationCount: 0 }), NOW);
    const many = computeEstimate(input({ integrationCount: 6 }), NOW);
    expect(many.midpoint).toBeGreaterThan(none.midpoint);
  });

  it("ignores a negative count rather than crediting the client", () => {
    const negative = computeEstimate(input({ integrationCount: -5 }), NOW);
    const zero = computeEstimate(input({ integrationCount: 0 }), NOW);
    expect(negative.midpoint).toBe(zero.midpoint);
  });

  it("prices fine-tuning above prompt configuration on the AI track", () => {
    const prompt = computeEstimate(
      input({ serviceFamily: "ai-enablement", customModelWork: "prompt-workflow" }),
      NOW
    );
    const tuned = computeEstimate(
      input({ serviceFamily: "ai-enablement", customModelWork: "fine-tuning" }),
      NOW
    );
    expect(tuned.midpoint).toBeGreaterThan(prompt.midpoint);
  });

  it("does not bill brand preparation on top of a purchased brand identity", () => {
    // Regression: "no brand assets" is the REASON someone buys brand identity.
    // Charging the readiness gap as well billed the same work twice.
    const buying = computeEstimate(
      input({
        serviceFamily: "marketing-design",
        marketingDeliverables: ["brand-identity"],
        brandAssetsReady: "none"
      }),
      NOW
    );
    expect(buying.lineItems.some((entry) => entry.key === "mkt_brand")).toBe(false);
  });

  it("still bills brand preparation when brand identity is not being purchased", () => {
    const notBuying = computeEstimate(
      input({
        serviceFamily: "marketing-design",
        marketingDeliverables: ["seo"],
        brandAssetsReady: "none"
      }),
      NOW
    );
    expect(notBuying.lineItems.some((entry) => entry.key === "mkt_brand")).toBe(true);
  });

  it("prices a full brand identity above a single graphic-design deliverable", () => {
    const graphic = computeEstimate(
      input({ serviceFamily: "marketing-design", marketingDeliverables: ["graphic-design"] }),
      NOW
    );
    const brand = computeEstimate(
      input({ serviceFamily: "marketing-design", marketingDeliverables: ["brand-identity"] }),
      NOW
    );
    expect(brand.midpoint).toBeGreaterThan(graphic.midpoint);
  });
});

describe("computeEstimate — multipliers", () => {
  it("applies a rush premium for a sub-two-week launch", () => {
    const relaxed = computeEstimate(input({ targetLaunch: "flexible" }), NOW);
    const rushed = computeEstimate(input({ targetLaunch: "under-2-weeks" }), NOW);
    expect(rushed.midpoint).toBeGreaterThan(relaxed.midpoint);
    expect(rushed.multipliers.some((entry) => entry.key === "rush")).toBe(true);
  });

  it("records no rush factor for a relaxed timeline", () => {
    const relaxed = computeEstimate(input({ targetLaunch: "4-plus-months" }), NOW);
    expect(relaxed.multipliers.some((entry) => entry.key === "rush")).toBe(false);
  });

  it("derives the rush tier from a fixed deadline", () => {
    const soon = computeEstimate(
      input({ targetLaunch: "fixed-date", requestedDeadline: "2026-09-08" }),
      NOW
    );
    const later = computeEstimate(
      input({ targetLaunch: "fixed-date", requestedDeadline: "2027-06-01" }),
      NOW
    );
    expect(soon.midpoint).toBeGreaterThan(later.midpoint);
    expect(soon.multipliers.find((entry) => entry.key === "rush")?.factor).toBe(1.35);
    expect(later.multipliers.some((entry) => entry.key === "rush")).toBe(false);
  });

  it("ignores an unparseable deadline instead of throwing", () => {
    const result = computeEstimate(
      input({ targetLaunch: "fixed-date", requestedDeadline: "not-a-date" }),
      NOW
    );
    expect(result.multipliers.some((entry) => entry.key === "rush")).toBe(false);
  });

  it("caps the summed compliance uplift", () => {
    const everything = computeEstimate(
      input({
        complianceRequirements: ["accessibility", "privacy-pii", "pci", "health", "financial", "government", "soc-iso"]
      }),
      NOW
    );
    const factor = everything.multipliers.find((entry) => entry.key === "compliance")?.factor ?? 1;
    expect(factor).toBeCloseTo(1.45, 5);
  });

  it("treats 'none known' compliance as no uplift", () => {
    const result = computeEstimate(input({ complianceRequirements: ["none"] }), NOW);
    expect(result.multipliers.some((entry) => entry.key === "compliance")).toBe(false);
  });

  it("adds a rescue premium for a stalled project", () => {
    const rescue = computeEstimate(input({ projectStage: "rescue" }), NOW);
    expect(rescue.multipliers.some((entry) => entry.key === "rescue")).toBe(true);
  });

  it("always applies project management and QA uplifts", () => {
    const result = computeEstimate(input(), NOW);
    expect(result.uplifts.map((entry) => entry.key)).toEqual(["pm", "qa"]);
    expect(result.midpoint).toBeGreaterThan(result.subtotal);
  });
});

describe("computeEstimate — confidence", () => {
  it("quotes a firm band when nothing is unknown", () => {
    const result = computeEstimate(
      input({ authRequired: "customers", dataMigration: "small", budgetBand: "10000-25000" }),
      NOW
    );
    expect(result.unknownCount).toBe(0);
    expect(result.confidence).toBe("firm");
    expect(result.spread).toBe(0.15);
  });

  it("widens the band as unknowns accumulate", () => {
    const vague = computeEstimate(
      input({
        authRequired: "unknown",
        dataMigration: "unknown",
        paymentsRequired: "unknown",
        supportLevel: "unknown",
        trainingRequired: "unknown"
      }),
      NOW
    );
    expect(vague.unknownCount).toBeGreaterThanOrEqual(4);
    expect(vague.confidence).toBe("rough");
    expect(vague.spread).toBe(0.35);
  });

  it("counts an unstated budget as an unknown", () => {
    const result = computeEstimate(input({ budgetBand: "guidance-needed" }), NOW);
    expect(result.unknownCount).toBe(1);
  });

  it("forces the widest band for a discovery-only intake", () => {
    const result = computeEstimate(input({ projectStage: "discovery", authRequired: "customers" }), NOW);
    expect(result.confidence).toBe("rough");
  });
});

describe("computeEstimate — budget fit and review flags", () => {
  it("flags an estimate that overshoots the stated budget", () => {
    const result = computeEstimate(
      input({ webSurface: "saas-app", pageCount: 40, budgetBand: "under-2500" }),
      NOW
    );
    expect(result.budgetFit).toBe("above");
    expect(result.reviewFlags.join(" ")).toContain("exceeds the stated budget");
  });

  it("flags an estimate below the stated budget as unstated scope", () => {
    const result = computeEstimate(
      input({ webSurface: "marketing-site", budgetBand: "50000-plus" }),
      NOW
    );
    expect(result.budgetFit).toBe("below");
  });

  it("reports an unstated budget when the client asked for guidance", () => {
    expect(computeEstimate(input({ budgetBand: "guidance-needed" }), NOW).budgetFit).toBe("unstated");
  });

  it("flags a client collecting multiple bids", () => {
    const result = computeEstimate(input({ decisionReadiness: "collecting-bids" }), NOW);
    expect(result.reviewFlags.join(" ")).toContain("multiple bids");
  });

  it("flags regulated data", () => {
    const result = computeEstimate(
      input({ serviceFamily: "ai-enablement", dataSensitivity: "regulated" }),
      NOW
    );
    expect(result.reviewFlags.join(" ")).toContain("Regulated data");
  });
});

describe("computeEstimate — recurring work", () => {
  it("emits a maintenance retainer alongside the build price", () => {
    const result = computeEstimate(input({ supportLevel: "monthly" }), NOW);
    expect(result.retainerKind).toBe("maintenance");
    expect(result.monthlyRetainer).toEqual({ low: 750, high: 2_000 });
    expect(result.midpoint).toBeGreaterThan(0);
  });

  it("prefers the fractional band for a consulting retainer", () => {
    const result = computeEstimate(
      input({ serviceFamily: "consulting", engagementType: "retainer", supportLevel: "monthly" }),
      NOW
    );
    expect(result.retainerKind).toBe("fractional");
  });

  it("emits a marketing retainer for an ongoing program", () => {
    const result = computeEstimate(
      input({ serviceFamily: "marketing-design", campaignDuration: "ongoing" }),
      NOW
    );
    expect(result.retainerKind).toBe("marketing");
  });

  it("emits no retainer for a one-time build handed off at launch", () => {
    const result = computeEstimate(input({ supportLevel: "launch-only" }), NOW);
    expect(result.retainerKind).toBeNull();
    expect(result.monthlyRetainer).toBeNull();
  });
});

describe("computeEstimate — realistic scenarios stay in defensible ranges", () => {
  it("prices a small brochure site in the low five figures", () => {
    const result = computeEstimate(
      {
        serviceFamily: "website-build",
        projectStage: "new",
        webSurface: "marketing-site",
        pageCount: 6,
        authRequired: "none",
        requestedCapabilities: ["public-intake", "email-notifications"],
        paymentsRequired: "none",
        dataMigration: "none",
        integrationCount: 1,
        brandAssetsReady: "complete",
        designReadiness: "concept",
        contentReadiness: "mostly-ready",
        targetLaunch: "2-4-months",
        trainingRequired: "written",
        supportLevel: "30-days",
        complianceRequirements: ["none"],
        budgetBand: "10000-25000"
      },
      NOW
    );
    expect(result.midpoint).toBeGreaterThan(10_000);
    expect(result.midpoint).toBeLessThan(30_000);
  });

  it("prices a regulated customer portal in the mid five figures or above", () => {
    const result = computeEstimate(
      {
        serviceFamily: "web-application",
        projectStage: "new",
        webSurface: "customer-portal",
        pageCount: 24,
        authRequired: "both",
        roleCount: 4,
        dashboardCount: 2,
        requestedCapabilities: ["database", "admin-dashboard", "advanced-roles", "file-uploads", "reporting"],
        fileUploads: true,
        paymentsRequired: "invoicing",
        esignRequired: true,
        cmsRequired: true,
        dataMigration: "medium",
        integrationCount: 4,
        dataSensitivity: "regulated",
        brandAssetsReady: "partial",
        designReadiness: "concept",
        contentReadiness: "partial",
        targetLaunch: "2-4-months",
        trainingRequired: "multiple-sessions",
        supportLevel: "retainer",
        complianceRequirements: ["privacy-pii", "health", "accessibility"],
        budgetBand: "50000-plus"
      },
      NOW
    );
    expect(result.midpoint).toBeGreaterThan(45_000);
    expect(result.retainerKind).toBe("advisory");
  });

  it("prices a small marketing engagement below a full portal build", () => {
    const marketing = computeEstimate(
      {
        serviceFamily: "marketing-design",
        projectStage: "new",
        marketingDeliverables: ["seo", "content"],
        marketingChannels: ["website", "search"],
        brandAssetsReady: "complete",
        designReadiness: "final",
        contentReadiness: "partial",
        campaignDuration: "under-3-months",
        targetLaunch: "1-2-months",
        trainingRequired: "none",
        supportLevel: "launch-only",
        complianceRequirements: ["none"]
      },
      NOW
    );
    expect(marketing.midpoint).toBeGreaterThan(MINIMUM_ENGAGEMENT);
    expect(marketing.midpoint).toBeLessThan(30_000);
  });
});
