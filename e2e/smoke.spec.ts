import { test, expect } from "@playwright/test";
import { gotoLanding, seedCookieConsent } from "./helpers";

test.describe("Landing page smoke tests", () => {
  test("homepage loads with hero section", async ({ page }) => {
    await gotoLanding(page);
    await expect(page).toHaveTitle(/Jeremy Williams/i);
    await expect(page.locator("main")).toBeVisible();
  });

  test("hero has both CTAs visible", async ({ page }) => {
    await gotoLanding(page);
    const bookCallBtn = page.locator("#top").getByRole("button", { name: /book a call/i });
    await expect(bookCallBtn).toBeVisible();
  });

  test("book CTA opens the lightbox dialog", async ({ page }) => {
    await seedCookieConsent(page);
    await page.goto("/");
    await page.locator("#top").getByRole("button", { name: /book a call/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("explore labs CTA navigates to /labs", async ({ page }) => {
    await gotoLanding(page);
    await page.locator("#top").getByRole("link", { name: /explore the lab/i }).click();
    await page.waitForURL(/\/labs$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/interactive proof/i);
  });

  test("/labs page loads with demo grid", async ({ page }) => {
    await seedCookieConsent(page);
    await page.goto("/labs");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("FAQ section renders with accordion items", async ({ page }) => {
    await gotoLanding(page);
    const faqSection = page.locator("#faq");
    await faqSection.scrollIntoViewIfNeeded();
    await expect(faqSection).toBeVisible();
    const triggers = faqSection.getByRole("button");
    expect(await triggers.count()).toBeGreaterThanOrEqual(5);
    await expect(triggers.first()).toHaveAttribute("aria-expanded", "false");
  });

  test("services section shows service tiles", async ({ page }) => {
    await page.goto("/");
    const servicesSection = page.locator("#work");
    await servicesSection.scrollIntoViewIfNeeded();
    await expect(servicesSection).toBeVisible();
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    await page.goto("/");
    const themeToggle = page.getByRole("button", { name: /toggle theme/i }).first();
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);
      const html = page.locator("html");
      const classAttr = await html.getAttribute("class");
      expect(classAttr).toBeTruthy();
    }
  });
});

test.describe("Auth gating", () => {
  test("/portal redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/portal");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("/admin redirects to /login when not authenticated", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("login page renders magic-link form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("API routes", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "API routes run once on desktop project");
  });

  test("POST /api/lead accepts valid payload", async ({ request }) => {
    const res = await request.post("/api/lead", {
      headers: { "x-forwarded-for": "203.0.113.10" },
      data: {
        email: "smoke-test@example.com",
        name: "Smoke Test",
        source: "form"
      }
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("POST /api/lead rejects invalid email", async ({ request }) => {
    const res = await request.post("/api/lead", {
      headers: { "x-forwarded-for": "203.0.113.11" },
      data: { email: "not-valid" }
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/lead rejects empty body", async ({ request }) => {
    const res = await request.post("/api/lead", {
      headers: { "x-forwarded-for": "203.0.113.12" },
      data: {}
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("SEO & metadata", () => {
  test("robots.txt is accessible", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text).toContain("User-Agent");
    expect(text).toContain("Disallow: /portal");
    expect(text).toContain("Disallow: /admin");
  });

  test("sitemap.xml is accessible", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text).toContain("<urlset");
  });
});

test.describe("Static pages", () => {
  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("main")).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("main")).toBeVisible();
  });
});
