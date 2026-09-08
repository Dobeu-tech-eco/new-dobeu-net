import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { CONTENT_DATES, SHIPPED_WORK } from "@/lib/jeremy-data";

describe("sitemap", () => {
  it("lists commercial routes and case-study slugs with content dates", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/pricing"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/services"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/case-studies/lastplate"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/services/ai-agents"))).toBe(true);

    const home = entries.find((e) => e.url.endsWith("/"));
    const privacy = entries.find((e) => e.url.endsWith("/privacy"));
    expect(home?.lastModified).toEqual(new Date(`${CONTENT_DATES.home}T00:00:00.000Z`));
    expect(privacy?.lastModified).toEqual(new Date(`${CONTENT_DATES.privacy}T00:00:00.000Z`));
    expect(home?.lastModified).not.toEqual(privacy?.lastModified);
    expect(SHIPPED_WORK.every((item) => urls.some((u) => u.endsWith(`/case-studies/${item.slug}`)))).toBe(true);
  });
});
