import { test, expect } from "@playwright/test";
import { gotoLanding, seedCookieConsent } from "../helpers";

test.describe("Labs visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await seedCookieConsent(page);
    await page.goto("/labs");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("labs page matches baseline", async ({ page }) => {
    await expect(page).toHaveScreenshot("labs-full-page.png", {
      fullPage: true,
      animations: "disabled",
    });
  });
});
