import { test, expect } from "@playwright/test";
import {
  canRunSupabaseE2E,
  createServiceClient,
  ensureTestUser,
  loginAs,
  skipReason
} from "./portal-session";

/**
 * Customer-side view of work an admin posted for them.
 *
 * This spec does not run admin AAL2: it enrolls no TOTP factor (see
 * e2e/totp.ts and e2e/company-step-up.spec.ts for a real step-up), the
 * magic-link session is AAL1 only, and CI sets no ADMIN_EMAILS. The admin
 * actions are covered by vitest. Here the rows are seeded through the service
 * role with the same shape `createWorkOrderForClient` writes (created_by = the
 * client, status 'quoted', quote fields set; invoices with user_id and no
 * project), then the customer's portal is checked for visibility and isolation.
 *
 * Addresses are *@test.dobeu.net only; no real inbox is involved.
 */
const CUSTOMER_A = "e2e-customer-a@test.dobeu.net";
const CUSTOMER_B = "e2e-customer-b@test.dobeu.net";

test.describe("admin-posted work, customer view", () => {
  test.describe.configure({ mode: "serial" });

  const title = `E2E admin-posted work ${Date.now()}`;
  let workOrderId: string | undefined;
  const invoiceIds: string[] = [];

  test.beforeAll(async () => {
    if (!canRunSupabaseE2E()) return;
    const admin = createServiceClient();
    const customerA = await ensureTestUser(admin, CUSTOMER_A);
    await ensureTestUser(admin, CUSTOMER_B);

    const { data: wo, error: woError } = await admin
      .from("work_orders")
      .insert({
        created_by: customerA,
        service_type: "logo",
        title,
        status: "quoted",
        quoted_amount_cents: 12_300,
        quoted_at: new Date().toISOString()
      })
      .select("id")
      .single();
    if (woError || !wo) throw new Error(`E2E seed work order failed: ${woError?.message}`);
    workOrderId = wo.id;

    const { data: invoices, error: invError } = await admin
      .from("invoices")
      .insert([
        { user_id: customerA, project_id: null, amount_cents: 12_300, status: "open" },
        {
          user_id: customerA,
          project_id: null,
          amount_cents: 45_600,
          status: "paid",
          paid_at: new Date().toISOString()
        }
      ])
      .select("id");
    if (invError || !invoices) throw new Error(`E2E seed invoices failed: ${invError?.message}`);
    invoiceIds.push(...invoices.map((i) => i.id));
  });

  test.afterAll(async () => {
    if (!canRunSupabaseE2E()) return;
    const admin = createServiceClient();
    if (invoiceIds.length) await admin.from("invoices").delete().in("id", invoiceIds);
    if (workOrderId) await admin.from("work_orders").delete().eq("id", workOrderId);
  });

  test("customer A sees the posted work order and both invoices", async ({ page }) => {
    test.skip(!canRunSupabaseE2E(), skipReason());

    await loginAs(page, CUSTOMER_A, "/portal/tickets");
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    await page.goto("/portal/invoices");
    await expect(page.getByRole("cell", { name: "$123", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$456", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "paid", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "open", exact: true })).toBeVisible();
  });

  test("customer B sees neither", async ({ page }) => {
    test.skip(!canRunSupabaseE2E(), skipReason());

    await loginAs(page, CUSTOMER_B, "/portal/tickets");
    await expect(page.getByRole("heading", { name: "Tickets", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);

    await page.goto("/portal/invoices");
    await expect(page.getByRole("heading", { name: "Invoices", level: 1 })).toBeVisible();
    await expect(page.getByRole("cell", { name: "$123", exact: true })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "$456", exact: true })).toHaveCount(0);
  });

  test("customer A is redirected away from /admin", async ({ page }) => {
    test.skip(!canRunSupabaseE2E(), skipReason());

    await loginAs(page, CUSTOMER_A, "/portal/tickets");
    await page.goto("/admin");
    await page.waitForURL(/\/portal(\/|$|\?)/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname.startsWith("/admin")).toBe(false);
  });
});
