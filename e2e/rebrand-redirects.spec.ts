import { test, expect } from "@playwright/test";

const retiredCaseStudies = [
  "monty-ai", "unified-ai", "statminer", "dts-contract", "sales-funnel", "lastplate",
];
const redirects = [
  ["/services/ai-agents", "/services/business-systems"],
  ...retiredCaseStudies.map((slug) => [`/case-studies/${slug}`, "/case-studies"]),
];

for (const [source, destination] of redirects) {
  test(`${source} permanently redirects to an available replacement`, async ({ request }) => {
    const response = await request.get(`${source}?ref=bookmark`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(`${destination}?ref=bookmark`);
    const target = await request.get(response.headers().location);
    expect(target.status()).toBe(200);
  });
}

test("terms displays the rebrand revision date", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.locator("main time")).toHaveAttribute("datetime", "2026-10-22");
  await expect(page.getByText(/Last updated:/)).toContainText("2026");
});
