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

/**
 * Make `next/font` (loaded with `display: optional`) render deterministically.
 *
 * `display: optional` only gives the browser a ~100ms window to apply the
 * webfont; miss it and the page paints in the taller fallback for that load and
 * never swaps — so `toHaveScreenshot` baselines captured on a "fallback" load
 * (and page height) don't match a "font-applied" load. `document.fonts.ready`
 * alone doesn't prevent this. The fix: let the first load download+cache the
 * font, then reload — a cached `optional` font paints within the window, so the
 * font-applied render (the one users see and the intended design) is stable.
 */
export async function settleFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
}

export async function gotoLanding(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedCookieConsent(page);
  await page.goto("/");
  await settleFonts(page);
  await page.locator("#top").scrollIntoViewIfNeeded();
}
