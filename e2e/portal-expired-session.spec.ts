import { test, expect } from "@playwright/test";
import { canRunSupabaseE2E, loginAs, skipReason } from "./portal-session";

/**
 * An expired portal session must not surface an error boundary when a form is
 * submitted. Middleware answers the server-action POST with an action-aware
 * redirect (303 + x-action-redirect), so the browser should land on
 * /login?next=... instead of "Something went wrong".
 *
 * Skips when no local Supabase stack / E2E creds are available.
 */
const projectSlug = (name: string) => name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

test.describe("expired portal session", () => {
  test("ticket form submit redirects to /login with next", async ({ page }, testInfo) => {
    test.skip(!canRunSupabaseE2E(), skipReason());

    await loginAs(
      page,
      `e2e-expired-${projectSlug(testInfo.project.name)}@test.dobeu.net`,
      "/portal/tickets"
    );
    await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "New ticket" }).click();
    await expect(page.getByRole("dialog", { name: "Open a new ticket" })).toBeVisible();
    await page.getByLabel("Service type").selectOption("logo");
    await page.getByLabel("Title").fill(`Expired session ${Date.now()}`);
    await page.getByLabel("Notes").fill("Submitted after the session cookies were cleared.");

    // Simulate expiry: drop every auth cookie while the form stays open.
    await page.context().clearCookies();

    await page.getByRole("button", { name: "Submit ticket" }).click();

    await page.waitForURL(/\/login\?.*next=/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get("next")).toContain("/portal");

    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expect(page.getByText("Application error")).toHaveCount(0);
  });
});
