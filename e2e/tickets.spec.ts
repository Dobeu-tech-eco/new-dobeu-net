import { config as loadEnv } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";

// Playwright does not load Next.js env files — pull Supabase keys for auth setup.
loadEnv({ path: path.resolve(__dirname, "../.env.local") });

const E2E_PORTAL_EMAIL = process.env.E2E_PORTAL_EMAIL ?? "e2e-portal@test.dobeu.net";

const SKIP_REASON =
  "Missing Supabase E2E env (NEXT_PUBLIC_VERCEL_SUPABASE_URL, NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY, VERCEL_SUPABASE_SERVICE_ROLE_KEY). Optional: E2E_PORTAL_EMAIL.";

function resolveSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_VERCEL_SUPABASE_URL ?? process.env.VERCEL_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY;
  const serviceKey = process.env.VERCEL_SUPABASE_SERVICE_ROLE_KEY;
  return { url, anonKey, serviceKey };
}

/**
 * Ticket-flow E2E needs a Supabase-backed portal session. The app is magic-link
 * only, so we seed/ensure a test user via the service role and sign in through
 * `auth.admin.generateLink` → `/auth/callback`.
 *
 * Set `E2E_PORTAL_EMAIL` to override the default test address.
 */
function canRunTicketFlowE2E(): boolean {
  const { url, anonKey, serviceKey } = resolveSupabaseEnv();
  return Boolean(url && anonKey && serviceKey);
}

async function ensurePortalTestUser(email: string, url: string, serviceKey: string) {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`E2E listUsers failed: ${error.message}`);

  if (!data.users.some((u) => u.email === email)) {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true
    });
    if (createError) throw new Error(`E2E createUser failed: ${createError.message}`);
  }
}

async function loginPortalUser(page: Page) {
  const { url, serviceKey } = resolveSupabaseEnv();
  if (!url || !serviceKey) {
    throw new Error("Supabase env missing for E2E auth");
  }

  await ensurePortalTestUser(E2E_PORTAL_EMAIL, url, serviceKey);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const redirectTo = `http://localhost:3000/auth/callback?next=${encodeURIComponent("/portal/tickets")}`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: E2E_PORTAL_EMAIL,
    options: { redirectTo }
  });

  const actionLink = data.properties?.action_link;
  if (error || !actionLink) {
    throw new Error(`E2E generateLink failed: ${error?.message ?? "no action_link"}`);
  }

  await page.goto(actionLink);
  await page.waitForURL(/\/portal\/tickets/, { timeout: 30_000 });
}

test.describe("client ticket flow", () => {
  test("submit a request and see it listed", async ({ page }) => {
    test.skip(!canRunTicketFlowE2E(), SKIP_REASON);

    await loginPortalUser(page);

    const title = `E2E test request ${Date.now()}`;

    await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "New ticket" }).click();
    await expect(page.getByRole("dialog", { name: "Open a new ticket" })).toBeVisible();

    await page.getByLabel("Service type").selectOption("logo");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Notes").fill("Created by the Playwright ticket-flow journey.");

    await page.getByRole("button", { name: "Submit ticket" }).click();

    await expect(page.getByRole("dialog", { name: "Open a new ticket" })).toBeHidden({
      timeout: 15_000
    });

    // Server action revalidates paths; reload if the client list hasn't refreshed yet.
    const ticketLink = page.getByRole("link", { name: title });
    try {
      await expect(ticketLink).toBeVisible({ timeout: 5_000 });
    } catch {
      await page.reload();
      await expect(ticketLink).toBeVisible({ timeout: 15_000 });
    }
  });
});
