import { test, expect } from "@playwright/test";
import { gotoLanding } from "../helpers";

test.describe("Landing visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoLanding(page);
    await page.evaluate(() => document.fonts.ready);
    // The shader wrapper is `absolute inset-0`. Masking that box paints over
    // the hero copy. Hide the wrapper so the baseline still records the type.
    await page.addStyleTag({
      content: [
        '[data-testid="hero-shader-background"]{visibility:hidden!important}',
        "nextjs-portal{display:none!important}",
      ].join(""),
    });
    await expect(page.locator("#hero-heading")).toBeVisible();
  });

  test("hero above-the-fold matches baseline", async ({ page }) => {
    const hero = page.locator("#top");
    await expect(hero).toHaveScreenshot("landing-hero.png", {
      animations: "disabled",
    });
  });

  test("full landing page matches baseline", async ({ page }) => {
    await expect(page).toHaveScreenshot("landing-full-page.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
