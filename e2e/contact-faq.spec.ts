import { test, expect } from "@playwright/test";
import { seedCookieConsent } from "./helpers";

test("contact is reachable from the footer with the collaboration form", async ({ page }) => {
  await seedCookieConsent(page);
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Contact", exact: true }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let's build something useful.");
  await expect(page.getByLabel("Company (optional)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send your idea" })).toBeVisible();
  await expect(page.locator('main a[href^="mailto:"]')).toBeVisible();
});

test("FAQ footer link opens a working accordion", async ({ page }) => {
  await seedCookieConsent(page);
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "FAQ", exact: true }).click();
  await expect(page).toHaveURL(/\/faq$/);
  const question = page.getByRole("button", { name: "What is Dobeu?", exact: true });
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Dobeu is the home for Jeremy Williams's passion projects", { exact: false })).toBeVisible();
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "false");
});
