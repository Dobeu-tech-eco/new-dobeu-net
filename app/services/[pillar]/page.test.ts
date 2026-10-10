import { describe, expect, it } from "vitest";
import { getServicePillar } from "@/lib/jeremy-data";
import { generateStaticParams } from "./page";

describe("service pillar routes", () => {
  it("generates a static param for each GTM pillar", () => {
    const params = generateStaticParams();
    expect(params.map((p) => p.pillar)).toEqual([
      "on-the-shift",
      "the-job",
      "one-person",
      "earned-product",
    ]);
  });

  it("unknown slugs do not resolve to a pillar", () => {
    expect(getServicePillar("not-a-pillar")).toBeUndefined();
  });

  it("canonical path matches the slug", () => {
    const pillar = getServicePillar("on-the-shift");
    expect(pillar?.slug).toBe("on-the-shift");
  });
});
