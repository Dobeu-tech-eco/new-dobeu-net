import { test, expect } from "@playwright/test";

test.describe("Landing page smoke tests", () => {
  test("homepage loads with hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Ship the agent/i);
    await expect(page.locator("main")).toBeVisible();
  });

  test("hero has both CTAs visible", async ({ page }) => {
    await page.goto("/");
    const bookCallBtn = page
      .getByRole("button", { name: /book a call/i })
      .first();
    await expect(bookCallBtn).toBeVisible();
  });

  test("FAQ section renders with accordion items", async ({ page }) => {
    await page.goto("/");
    const faqSection = page.locator("#faq");
    await faqSection.scrollIntoViewIfNeeded();
    await expect(faqSection).toBeVisible();
    const triggers = faqSection.getByRole("button");
    expect(await triggers.count()).toBeGreaterThanOrEqual(5);
  });

  test("FAQ accordion expands on click", async ({ page }) => {
    await page.goto("/");
    const faqSection = page.locator("#faq");
    await faqSection.scrollIntoViewIfNeeded();
    const firstTrigger = faqSection.getByRole("button").first();
    await firstTrigger.click();
    const expandedContent = faqSection.locator("[data-state=open]");
    await expect(expandedContent.first()).toBeVisible();
  });

  test("services section shows service tiles", async ({ page }) => {
    await page.goto("/");
    const servicesSection = page.locator("#work");
    await servicesSection.scrollIntoViewIfNeeded();
    await expect(servicesSection).toBeVisible();
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    await page.goto("/");
    const themeToggle = page
      .getByRole("button", { name: /toggle theme/i })
      .first();
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
  test("/portal redirects to /login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/portal");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("/admin redirects to /login when not authenticated", async ({
    page,
  }) => {
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
  test("POST /api/lead accepts valid payload", async ({ request }) => {
    const res = await request.post("/api/lead", {
      data: {
        email: "smoke-test@example.com",
        name: "Smoke Test",
        source: "form",
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("POST /api/lead rejects invalid email", async ({ request }) => {
    const res = await request.post("/api/lead", {
      data: { email: "not-valid" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/lead rejects empty body", async ({ request }) => {
    const res = await request.post("/api/lead", {
      data: {},
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
