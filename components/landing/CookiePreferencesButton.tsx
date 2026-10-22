"use client";

/**
 * Re-opens the cookie consent dialog via the global CookieBanner exposes.
 * The only interactive bit of SiteFooter, so the footer itself can stay a
 * Server Component and skip hydration.
 */
export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      className="hover:text-foreground transition-colors"
      onClick={() => {
        if (
          typeof window !== "undefined" &&
          (window as Window & { openCookiePreferences?: () => void }).openCookiePreferences
        ) {
          (window as Window & { openCookiePreferences?: () => void }).openCookiePreferences!();
        }
      }}
    >
      Cookie preferences
    </button>
  );
}
