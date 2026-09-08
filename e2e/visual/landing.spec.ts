import { test, expect } from "@playwright/test";
import { gotoLanding } from "../helpers";

test.describe("Landing visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoLanding(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("#hero-heading")).toBeVisible();
  });

  test("hero above-the-fold matches baseline", async ({ page }) => {
    const hero = page.locator("#top");
    await expect(hero).toHaveScreenshot("landing-hero.png", {
      animations: "disabled",
      mask: [
        page.locator('[data-testid="hero-shader-background"]'),
        page.locator('[data-testid="hero-typewriter"]'),
        page.locator('[data-testid="hero-activity-ticker"]'),
      ],
    });
  });

  test("full landing page matches baseline", async ({ page }) => {
    await expect(page).toHaveScreenshot("landing-full-page.png", {
      fullPage: true,
      animations: "disabled",
      mask: [
        page.locator('[data-testid="hero-shader-background"]'),
        page.locator('[data-testid="hero-typewriter"]'),
        page.locator('[data-testid="hero-activity-ticker"]'),
      ],
    });
  });
});
