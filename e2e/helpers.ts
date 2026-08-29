import type { Page } from "@playwright/test";

const CONSENT_VALUE = encodeURIComponent(
  JSON.stringify({ analytics: false, support: false, marketing: false }),
);

/** Skip first-visit cookie banner by seeding consent before React hydrates. */
export async function seedCookieConsent(page: Page) {
  await page.addInitScript((value) => {
    document.cookie = `dobeu_cookie_consent=${value}; path=/; SameSite=Lax`;
  }, CONSENT_VALUE);
}

export async function gotoLanding(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedCookieConsent(page);
  await page.goto("/");
  await page.locator("#top").scrollIntoViewIfNeeded();
}
