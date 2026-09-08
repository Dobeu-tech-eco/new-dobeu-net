import { describe, expect, it } from "vitest";
import { getServicePillar } from "@/lib/jeremy-data";
import { generateStaticParams } from "./page";

describe("service pillar routes", () => {
  it("generates a static param for each GTM pillar", () => {
    const params = generateStaticParams();
    expect(params.map((p) => p.pillar)).toEqual([
      "ai-agents",
      "fullstack",
      "brand",
      "growth",
    ]);
  });

  it("unknown slugs do not resolve to a pillar", () => {
    expect(getServicePillar("not-a-pillar")).toBeUndefined();
  });

  it("canonical path matches the slug", () => {
    const pillar = getServicePillar("ai-agents");
    expect(pillar?.slug).toBe("ai-agents");
  });
});
