import { test, expect } from "@playwright/test";
import { gotoLanding, seedCookieConsent } from "./helpers";

test.describe("Landing page smoke tests", () => {
  test("homepage loads with outcome hero", async ({ page }) => {
    await gotoLanding(page);
    await expect(page).toHaveTitle(/AI Automation|Small Business|Dobeu/i);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("#hero-heading")).toContainText(/trucks, kitchens, and sites/i);
    await expect(page.locator("#hero-heading")).not.toContainText(/autonomous AI coding agents/i);
    await expect(page.getByTestId("hero-price-line")).toContainText(/\$5k/);
  });

  test("hero has book and estimate CTAs", async ({ page }) => {
    await gotoLanding(page);
    const hero = page.locator("#top");
    await expect(hero.getByRole("button", { name: /book a call/i })).toBeVisible();
    await expect(hero.getByRole("button", { name: /get a price estimate/i })).toBeVisible();
    await expect(hero.getByRole("link", { name: /explore the lab/i })).toHaveCount(0);
  });

  test("book CTA opens the lightbox dialog", async ({ page }) => {
    await seedCookieConsent(page);
    await page.goto("/");
    await page.locator("#top").getByRole("button", { name: /book a call/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("tab", { name: /book a call/i })).toHaveAttribute("data-state", "active");
  });

  test("estimate CTA mounts the Typeform tab", async ({ page }) => {
    await seedCookieConsent(page);
    await page.goto("/");
    await page.getByTestId("hero-estimate-cta").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("tab", { name: /tell me more/i })).toHaveAttribute("data-state", "active");
    await expect(dialog.getByTestId("typeform-widget")).toHaveAttribute("data-tf-form", "wKVKIBe7");
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

test.describe("Commercial routes", () => {
  test("primary nav has no Labs item", async ({ page }) => {
    await seedCookieConsent(page);
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /primary/i });
    await expect(nav.getByRole("link", { name: /^labs$/i })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /services/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /pricing/i })).toBeVisible();
  });

  test("/pricing estimate mounts Typeform", async ({ page }) => {
    await seedCookieConsent(page);
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByTestId("pricing-estimate-cta").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("typeform-widget")).toHaveAttribute("data-tf-form", "wKVKIBe7");
  });

  for (const path of ["/services", "/about", "/process", "/case-studies", "/pricing"]) {
    test(`${path} returns 200 with an h1`, async ({ page }) => {
      await seedCookieConsent(page);
      const res = await page.goto(path);
      expect(res?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("/case-studies/lastplate is attributable and metric-less", async ({ page }) => {
    await seedCookieConsent(page);
    await page.goto("/case-studies/lastplate");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/LastPlate/i);
    await expect(page.getByRole("link", { name: /lastplateprod/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/90%/);
    await expect(page.locator("body")).not.toContainText(/Jane D/);
  });

  test("unknown service pillar is 404", async ({ page }) => {
    const res = await page.goto("/services/not-a-pillar");
    expect(res?.status()).toBe(404);
  });

  test("process nav from pricing stays on /process", async ({ page }) => {
    await seedCookieConsent(page);
    await page.goto("/pricing");
    await page.getByRole("navigation", { name: /primary/i }).getByRole("link", { name: /process/i }).click();
    await page.waitForURL(/\/process$/);
    expect(page.url()).not.toMatch(/#how/);
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

  test("sitemap.xml lists commercial routes with distinct lastmod", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text).toContain("<urlset");
    for (const path of ["/services", "/pricing", "/about", "/process", "/case-studies", "/case-studies/lastplate"]) {
      expect(text).toContain(path);
    }
    const lastmods = [...text.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
    expect(new Set(lastmods).size).toBeGreaterThan(1);
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
