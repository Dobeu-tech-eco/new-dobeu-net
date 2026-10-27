import { test, expect } from "@playwright/test";
import { gotoLanding, seedCookieConsent } from "./helpers";

const retiredPositioning =
  /\b(?:AI|agents?|consulting|consultancy|consultants?)\b|artificial intelligence/gi;
const publicRoutes = [
  "/contact",
  "/faq",
  "/",
  "/about",
  "/services",
  "/services/business-systems",
  "/services/fullstack",
  "/services/brand",
  "/services/growth",
  "/pricing",
  "/process",
  "/case-studies",
  "/case-studies/routeready",
  "/case-studies/chima-comics",
  "/case-studies/dobeu-space",
  "/case-studies/ikram-and-co",
  "/labs",
  "/repos",
  "/privacy",
  "/terms",
  "/cookies",
  "/optin/sms",
  "/marketing-opt-out",
  "/login",
];

for (const path of publicRoutes) {
  test(`${path} presents business technology without retired positioning`, async ({
    page,
  }) => {
    await seedCookieConsent(page);
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    await expect(page.locator("main")).toBeVisible();
    const copy = await page.evaluate(() => ({
      rendered: document.body.innerText,
      title: document.title,
      descriptions: Array.from(
        document.querySelectorAll(
          'meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]',
        ),
      )
        .map((meta) => meta.getAttribute("content") ?? "")
        .join("\n"),
      accessibleLabels: Array.from(
        document.querySelectorAll("[aria-label], img[alt]"),
      )
        .map(
          (element) =>
            element.getAttribute("aria-label") ??
            element.getAttribute("alt") ??
            "",
        )
        .join("\n"),
      structuredData: Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      )
        .map((script) => script.textContent ?? "")
        .join("\n"),
    }));
    for (const [surface, text] of Object.entries(copy)) {
      expect(text.match(retiredPositioning), `${path}: ${surface}`).toBeNull();
    }
    const width = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(width.content, `${path}: horizontal overflow`).toBeLessThanOrEqual(
      width.viewport + 1,
    );
  });
}

test("homepage showcases four usable products with live website links", async ({
  page,
}, testInfo) => {
  await gotoLanding(page);
  await expect(page.locator("#hero-heading")).toHaveText(
    "We build usable business technology.",
  );
  for (const href of [
    "https://routereadyhq.com",
    "https://chimacomics.shop",
    "https://dobeu.space",
    "https://www.dobeu.store/en",
  ]) {
    await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
  }
  await page.screenshot({
    path: `/tmp/new-dobeu-positioning-${testInfo.project.name === "mobile-chrome" ? "mobile" : "desktop"}.png`,
    fullPage: true,
    animations: "disabled",
  });
});

test("homepage introduces Jeremy’s interests and his LinkedIn profile", async ({
  page,
}) => {
  await gotoLanding(page);
  const about = page.locator("#about");
  await about.scrollIntoViewIfNeeded();
  await expect(
    about.getByRole("heading", { name: "Jeremy Williams", exact: true }),
  ).toBeVisible();
  await expect(about).toContainText(
    "seeing where curiosity leads",
  );
  await expect(about).toContainText("passion projects");
  await expect(
    about.getByRole("link", { name: "Jeremy on LinkedIn", exact: true }),
  ).toHaveAttribute("href", "https://www.linkedin.com/in/jswilliamstu");
});
