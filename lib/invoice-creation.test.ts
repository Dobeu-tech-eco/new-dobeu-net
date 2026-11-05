import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Mocks ---------------------------------------------------------------

const getUserById = vi.fn();
const profileSingle = vi.fn();
const profileEq = vi.fn(() => ({ single: profileSingle }));
const profileSelect = vi.fn(() => ({ eq: profileEq }));
const insertSingle = vi.fn();
const insertSelect = vi.fn(() => ({ single: insertSingle }));
const insert = vi.fn(() => ({ select: insertSelect }));
const existingLimit = vi.fn();
// The invoices table serves two chains: the stripe_invoice_id reuse lookup
// (`eq().limit()`) and the linked-invoice status read (`eq().single()`).
const linkedStatusSingle = vi.fn();
const existingEq = vi.fn(() => ({ limit: existingLimit, single: linkedStatusSingle }));
const existingSelect = vi.fn(() => ({ eq: existingEq }));

const workOrderSingle = vi.fn();
const workOrderEq = vi.fn(() => ({ single: workOrderSingle }));
const workOrderSelect = vi.fn(() => ({ eq: workOrderEq }));
const from = vi.fn((table: string) =>
  table === "profiles"
    ? { select: profileSelect }
    : table === "work_orders"
      ? { select: workOrderSelect }
      : { insert, select: existingSelect }
);

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { getUserById } },
    from: (table: string) => from(table)
  })),
  createClient: vi.fn()
}));

const getOrCreateStripeCustomer = vi.fn();
const createHostedInvoice = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getOrCreateStripeCustomer: (...a: unknown[]) => getOrCreateStripeCustomer(...a),
  createHostedInvoice: (...a: unknown[]) => createHostedInvoice(...a)
}));

const sendEmail = vi.fn();

vi.mock("@/lib/resend", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a)
}));

vi.mock("@/lib/resend-templates", () => ({
  invoiceReadyToClient: vi.fn(() => ({
    subject: "Your invoice is ready",
    text: "text",
    html: "<p>html</p>"
  }))
}));

import {
  alreadyInvoicedMessage,
  createInvoiceForUser,
  workOrderInvoiceIdempotencyKey
} from "@/lib/invoice-creation";

// ---- Fixtures ------------------------------------------------------------

const BASE_INPUT = {
  user_id: "u1",
  project_id: "p1",
  amount_cents: 25000,
  currency: "USD",
  description: "Discovery sprint"
};

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: everything succeeds so each test only overrides its failure.
  getUserById.mockResolvedValue({
    data: { user: { email: "client@example.com", user_metadata: { full_name: "Cli Ent" } } }
  });
  profileSingle.mockResolvedValue({ data: { full_name: "Profile Name" } });
  getOrCreateStripeCustomer.mockResolvedValue("cus_123");
  createHostedInvoice.mockResolvedValue({
    id: "in_123",
    hosted_invoice_url: "https://invoice.stripe.com/i/in_123"
  });
  insertSingle.mockResolvedValue({ data: { id: "inv_row_1" }, error: null });
  sendEmail.mockResolvedValue({ ok: true });
  existingLimit.mockResolvedValue({ data: [], error: null });
  // Default: the work order has never been billed (no linked invoice).
  workOrderSingle.mockResolvedValue({ data: { invoice_id: null }, error: null });
  // Default: a linked invoice (when a test links one) is void.
  linkedStatusSingle.mockResolvedValue({ data: { status: "void" }, error: null });
});

// ---- Tests ---------------------------------------------------------------

describe("createInvoiceForUser", () => {
  it("happy path: creates hosted invoice, persists row, emails client", async () => {
    const res = await createInvoiceForUser(BASE_INPUT);

    expect(res).toEqual({
      ok: true,
      data: {
        id: "inv_row_1",
        stripe_invoice_id: "in_123",
        hosted_invoice_url: "https://invoice.stripe.com/i/in_123"
      }
    });
    expect(getOrCreateStripeCustomer).toHaveBeenCalledWith({
      supabaseUserId: "u1",
      email: "client@example.com",
      name: "Cli Ent"
    });
    // Currency is lowercased for Stripe; metadata carries the linkage ids.
    expect(createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cus_123",
        amountCents: 25000,
        currency: "usd",
        description: "Discovery sprint",
        metadata: expect.objectContaining({ supabase_user_id: "u1", project_id: "p1" })
      })
    );
    // Local row mirrors Stripe state and always carries user_id (RLS).
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        project_id: "p1",
        amount_cents: 25000,
        currency: "USD",
        status: "open",
        stripe_invoice_id: "in_123",
        hosted_invoice_url: "https://invoice.stripe.com/i/in_123"
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "client@example.com", subject: "Your invoice is ready" })
    );
  });

  it("returns ok:false when the user cannot be resolved", async () => {
    getUserById.mockRejectedValue(new Error("boom"));

    const res = await createInvoiceForUser(BASE_INPUT);

    expect(res).toEqual({ ok: false, error: "unable to resolve user u1: boom" });
    expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns ok:false when the user has no email; touches neither Stripe nor DB", async () => {
    getUserById.mockResolvedValue({ data: { user: { email: null, user_metadata: null } } });

    const res = await createInvoiceForUser(BASE_INPUT);

    expect(res).toEqual({ ok: false, error: "user u1 has no email on file" });
    expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("falls back to the profiles table for the name when user_metadata lacks one", async () => {
    getUserById.mockResolvedValue({
      data: { user: { email: "client@example.com", user_metadata: {} } }
    });

    await createInvoiceForUser(BASE_INPUT);

    expect(profileSelect).toHaveBeenCalledWith("full_name");
    expect(profileEq).toHaveBeenCalledWith("id", "u1");
    expect(getOrCreateStripeCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Profile Name" })
    );
  });

  it("Stripe failure: still inserts a local row with NULL stripe ids, returns ok:false, sends no email", async () => {
    createHostedInvoice.mockRejectedValue(new Error("customer_creation_failed"));

    const res = await createInvoiceForUser(BASE_INPUT);

    expect(res).toEqual({
      ok: false,
      error: "Stripe error: customer_creation_failed",
      localInvoiceId: "inv_row_1"
    });
    // The NULL stripe_invoice_id row is the admin-visible signal of the failure.
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        status: "open",
        stripe_invoice_id: null,
        hosted_invoice_url: null
      })
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns ok:false when the local insert fails", async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: "insert exploded" } });

    const res = await createInvoiceForUser(BASE_INPUT);

    expect(res).toEqual({ ok: false, error: "insert exploded" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a failed invoice-ready email is non-fatal", async () => {
    sendEmail.mockRejectedValue(new Error("domain not verified"));

    const res = await createInvoiceForUser(BASE_INPUT);

    expect(res.ok).toBe(true);
  });

  it("reuses the existing local row (no second insert or email) when Stripe returns an invoice already recorded", async () => {
    existingLimit.mockResolvedValue({
      data: [
        { id: "inv_row_old", hosted_invoice_url: "https://invoice.stripe.com/i/in_123", status: "open" }
      ],
      error: null
    });

    const res = await createInvoiceForUser({ ...BASE_INPUT, work_order_id: "wo_9" });

    expect(res).toEqual({
      ok: true,
      data: {
        id: "inv_row_old",
        stripe_invoice_id: "in_123",
        hosted_invoice_url: "https://invoice.stripe.com/i/in_123",
        reused: true
      }
    });
    expect(existingEq).toHaveBeenCalledWith("stripe_invoice_id", "in_123");
    expect(insert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects (no reuse, no insert) when the only matching local row is void", async () => {
    existingLimit.mockResolvedValue({
      data: [{ id: "inv_row_void", hosted_invoice_url: null, status: "void" }],
      error: null
    });

    const res = await createInvoiceForUser({ ...BASE_INPUT, work_order_id: "wo_9" });

    expect(res).toEqual({
      ok: false,
      error:
        "Stripe returned a voided invoice for this work order; wait 24h, then try again"
    });
    expect(insert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("fails closed without inserting when the existing-row lookup errors", async () => {
    existingLimit.mockResolvedValue({ data: null, error: { message: "db down" } });

    const res = await createInvoiceForUser({ ...BASE_INPUT, work_order_id: "wo_9" });

    expect(res).toEqual({ ok: false, error: "Unable to check for an existing invoice record" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts normally when no local row has the Stripe invoice id", async () => {
    const res = await createInvoiceForUser({ ...BASE_INPUT, work_order_id: "wo_9" });

    expect(res.ok).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("omits project linkage when project_id is absent (work-order invoices)", async () => {
    const res = await createInvoiceForUser({
      user_id: "u1",
      amount_cents: 5000,
      currency: "usd",
      work_order_id: "wo_9"
    });

    expect(res.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: null, user_id: "u1" })
    );
    expect(createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "work-order-invoice:wo_9:v1",
        metadata: expect.objectContaining({ work_order_id: "wo_9", project_id: undefined })
      })
    );
  });
});

describe("work-order Stripe idempotency key", () => {
  const WO_INPUT = { ...BASE_INPUT, work_order_id: "wo_9" };

  it("without a work_order_id: no work_orders read and an undefined key", async () => {
    const res = await createInvoiceForUser(BASE_INPUT);

    expect(res.ok).toBe(true);
    expect(from).not.toHaveBeenCalledWith("work_orders");
    expect(workOrderSelect).not.toHaveBeenCalled();
    expect(createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: undefined })
    );
  });

  it("unlinked work order: keeps the v1 key", async () => {
    const res = await createInvoiceForUser(WO_INPUT);

    expect(res.ok).toBe(true);
    expect(workOrderSelect).toHaveBeenCalledWith("invoice_id");
    expect(workOrderEq).toHaveBeenCalledWith("id", "wo_9");
    expect(createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "work-order-invoice:wo_9:v1" })
    );
  });

  it("linked void invoice: the key carries the replaced invoice id", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_void_1" }, error: null });

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res.ok).toBe(true);
    expect(createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "work-order-invoice:wo_9:inv_void_1" })
    );
  });

  it("is retry-stable for the same link and changes when the link changes", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_void_1" }, error: null });
    await createInvoiceForUser(WO_INPUT);
    await createInvoiceForUser(WO_INPUT);
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_void_2" }, error: null });
    await createInvoiceForUser({ ...WO_INPUT, amount_cents: 30000 });

    const keys = createHostedInvoice.mock.calls.map(
      (c) => (c[0] as { idempotencyKey?: string }).idempotencyKey
    );
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).toBe("work-order-invoice:wo_9:inv_void_2");
    expect(keys[2]).not.toBe(keys[0]);
  });

  it.each([
    ["errors", { data: null, error: { message: "db down" } }],
    ["returns no row", { data: null, error: null }]
  ])("fails closed before Stripe when the work_orders read %s", async (_label, row) => {
    workOrderSingle.mockResolvedValue(row);

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res).toEqual({
      ok: false,
      error: "Unable to read the work order's current invoice link"
    });
    expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
    expect(createHostedInvoice).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("linked void invoice: reads that invoice's status and proceeds with the replaced-id key", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_void_1" }, error: null });

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res.ok).toBe(true);
    expect(existingSelect).toHaveBeenCalledWith("status");
    expect(existingEq).toHaveBeenCalledWith("id", "inv_void_1");
    expect(createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "work-order-invoice:wo_9:inv_void_1" })
    );
  });

  it.each(["open", "paid", "overdue"])(
    "refuses before Stripe when the linked invoice is %s (concurrent billing)",
    async (status) => {
      workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_live_1" }, error: null });
      linkedStatusSingle.mockResolvedValue({ data: { status }, error: null });

      const res = await createInvoiceForUser(WO_INPUT);

      expect(res).toEqual({
        ok: false,
        error: alreadyInvoicedMessage("inv_live_1")
      });
      expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
      expect(createHostedInvoice).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["errors", { data: null, error: { message: "db down" } }],
    ["returns no row", { data: null, error: null }]
  ])("fails closed before Stripe when the linked invoice status read %s", async (_label, row) => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_void_1" }, error: null });
    linkedStatusSingle.mockResolvedValue(row);

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res).toEqual({
      ok: false,
      error: "Unable to read the work order's current invoice link"
    });
    expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
    expect(createHostedInvoice).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a Stripe failure retry with the same link reuses the same key", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_void_1" }, error: null });
    createHostedInvoice.mockRejectedValueOnce(new Error("api_connection_error"));

    const first = await createInvoiceForUser(WO_INPUT);
    const second = await createInvoiceForUser(WO_INPUT);

    expect(first.ok).toBe(false);
    expect(first.ok === false && first.error).toBe("Stripe error: api_connection_error");
    expect(second.ok).toBe(true);
    const keys = createHostedInvoice.mock.calls.map(
      (c) => (c[0] as { idempotencyKey?: string }).idempotencyKey
    );
    expect(keys).toEqual([
      "work-order-invoice:wo_9:inv_void_1",
      "work-order-invoice:wo_9:inv_void_1"
    ]);
  });

  it("workOrderInvoiceIdempotencyKey: v1 when nothing is replaced, else the replaced id", () => {
    expect(workOrderInvoiceIdempotencyKey("wo_9", null)).toBe("work-order-invoice:wo_9:v1");
    expect(workOrderInvoiceIdempotencyKey("wo_9", "inv_void_1")).toBe(
      "work-order-invoice:wo_9:inv_void_1"
    );
  });
});
