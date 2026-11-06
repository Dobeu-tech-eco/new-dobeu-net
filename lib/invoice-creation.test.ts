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
// The audited-invoices read (`select().in("id", ids)`), set per test.
let auditedInvoices: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null
};
const existingIn = vi.fn(() => Promise.resolve(auditedInvoices));
const existingSelect = vi.fn(() => ({ eq: existingEq, in: existingIn }));

const workOrderSingle = vi.fn();
const workOrderEq = vi.fn(() => ({ single: workOrderSingle }));
const workOrderSelect = vi.fn(() => ({ eq: workOrderEq }));
// admin_audit_log: the newest-billed-invoice read (`in().eq().order().limit()`).
// Built per call from `auditResult`, which each test sets (default: no rows).
let auditResult: { data: unknown[] | null; error: { message: string } | null } = {
  data: [],
  error: null
};
const auditEq = vi.fn();
const auditOrder = vi.fn();
const auditIn = vi.fn();
const auditLimit = vi.fn();
function auditChain() {
  const chain: Record<string, unknown> = {};
  chain.in = (...a: unknown[]) => (auditIn(...a), chain);
  chain.eq = (...a: unknown[]) => (auditEq(...a), chain);
  chain.order = (...a: unknown[]) => (auditOrder(...a), chain);
  chain.limit = (...a: unknown[]) => (auditLimit(...a), Promise.resolve(auditResult));
  // The read is awaited directly after order() (no row limit).
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(auditResult).then(res, rej);
  return chain;
}
const auditSelect = vi.fn(() => auditChain());
const from = vi.fn((table: string) =>
  table === "profiles"
    ? { select: profileSelect }
    : table === "work_orders"
      ? { select: workOrderSelect }
      : table === "admin_audit_log"
        ? { select: auditSelect }
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
  AUDITED_INVOICE_MISSING,
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
  auditResult = { data: [], error: null };
  auditedInvoices = { data: [], error: null };
  // Default: a linked invoice (when a test links one) is void.
  linkedStatusSingle.mockResolvedValue({
    data: { status: "void", created_at: "2026-11-01T00:00:00Z" },
    error: null
  });
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
    expect(existingSelect).toHaveBeenCalledWith("status,created_at");
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

  // Test helpers: the audit read yields target ids only; the invoices behind
  // them (status + created_at) come from a second `in("id", ...)` read.
  const auditTargets = (...ids: (string | null)[]) => ({
    data: ids.map((target_id) => ({ target_id })),
    error: null
  });
  const invoiceRows = (
    ...rows: { id: string; created_at: string; status?: string }[]
  ) => ({
    data: rows.map((r) => ({ status: "void", ...r })),
    error: null
  });
  const keyOfLastCall = () =>
    (createHostedInvoice.mock.calls.at(-1)?.[0] as { idempotencyKey?: string })
      .idempotencyKey;

  it("link_failed then re-bill: audited B newer than the stale link A, so the key uses B", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_A" }, error: null });
    linkedStatusSingle.mockResolvedValue({
      data: { status: "void", created_at: "2026-11-01T00:00:00Z" },
      error: null
    });
    auditResult = auditTargets("inv_B");
    auditedInvoices = invoiceRows({ id: "inv_B", created_at: "2026-11-04T00:00:00Z" });

    const res = await createInvoiceForUser({ ...WO_INPUT, amount_cents: 30000 });

    expect(res.ok).toBe(true);
    expect(auditSelect).toHaveBeenCalledWith("target_id");
    expect(auditIn).toHaveBeenCalledWith("action", [
      "invoice.create",
      "invoice.create_for_work_order",
      "invoice.link_failed"
    ]);
    expect(auditEq).toHaveBeenCalledWith("data->>work_order_id", "wo_9");
    expect(auditOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(existingIn).toHaveBeenCalledWith("id", ["inv_B"]);
    expect(keyOfLastCall()).toBe("work-order-invoice:wo_9:inv_B");
  });

  it("considers an audit beyond the old 10-row window and sets no row limit", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_A" }, error: null });
    const ids = Array.from({ length: 12 }, (_, i) => `inv_${i}`);
    auditResult = auditTargets(...ids);
    auditedInvoices = {
      data: ids.map((id, i) => ({
        id,
        status: "void",
        // inv_11 (the 12th audit row) is the newest invoice.
        created_at: new Date(Date.UTC(2026, 10, 2 + (i === 11 ? 20 : 0))).toISOString()
      })),
      error: null
    };

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res.ok).toBe(true);
    expect(auditLimit).not.toHaveBeenCalled();
    expect(existingIn).toHaveBeenCalledWith("id", ids);
    expect(keyOfLastCall()).toBe("work-order-invoice:wo_9:inv_11");
  });

  it("refuses before Stripe when an audited invoice row no longer exists", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_A" }, error: null });
    auditResult = auditTargets("inv_B", "inv_C");
    auditedInvoices = invoiceRows({ id: "inv_B", created_at: "2026-11-04T00:00:00Z" });

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res).toEqual({ ok: false, error: AUDITED_INVOICE_MISSING });
    expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
    expect(createHostedInvoice).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("a plain retry with nothing newly billed keeps the same key", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_A" }, error: null });
    auditResult = auditTargets("inv_B");
    auditedInvoices = invoiceRows({ id: "inv_B", created_at: "2026-11-04T00:00:00Z" });
    createHostedInvoice.mockRejectedValueOnce(new Error("api_connection_error"));

    await createInvoiceForUser(WO_INPUT);
    await createInvoiceForUser(WO_INPUT);

    const keys = createHostedInvoice.mock.calls.map(
      (c) => (c[0] as { idempotencyKey?: string }).idempotencyKey
    );
    expect(keys).toEqual(["work-order-invoice:wo_9:inv_B", "work-order-invoice:wo_9:inv_B"]);
  });

  it("audited invoice equal to the link: no second invoices read, same key", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_A" }, error: null });
    auditResult = auditTargets("inv_A");

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res.ok).toBe(true);
    expect(existingIn).not.toHaveBeenCalled();
    expect(keyOfLastCall()).toBe("work-order-invoice:wo_9:inv_A");
  });

  it("linked B (audit write failed) is newer than audited A: the key uses the link", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_B" }, error: null });
    linkedStatusSingle.mockResolvedValue({
      data: { status: "void", created_at: "2026-11-03T00:00:00Z" },
      error: null
    });
    auditResult = auditTargets("inv_A");
    auditedInvoices = invoiceRows({ id: "inv_A", created_at: "2026-11-02T00:00:00Z" });

    const res = await createInvoiceForUser({ ...WO_INPUT, amount_cents: 30000 });

    expect(res.ok).toBe(true);
    expect(keyOfLastCall()).toBe("work-order-invoice:wo_9:inv_B");
  });

  it("delayed audit for older A (A.created < B.created < A.audit) cannot hide linked B", async () => {
    // The audit row's own time is deliberately not part of the fixture: recency
    // is decided by invoice created_at only, so a late audit row for A loses.
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_B" }, error: null });
    linkedStatusSingle.mockResolvedValue({
      data: { status: "void", created_at: "2026-11-03T00:00:00Z" },
      error: null
    });
    auditResult = auditTargets("inv_A"); // A's audit row is the newest audit row
    auditedInvoices = invoiceRows({ id: "inv_A", created_at: "2026-11-02T00:00:00Z" });

    const res = await createInvoiceForUser({ ...WO_INPUT, amount_cents: 30000 });

    expect(res.ok).toBe(true);
    expect(keyOfLastCall()).toBe("work-order-invoice:wo_9:inv_B");
    expect(keyOfLastCall()).not.toBe("work-order-invoice:wo_9:inv_A");
  });

  it("out-of-order audit rows: the newest by invoice created_at wins, not the newest audit row", async () => {
    auditResult = auditTargets("inv_old", "inv_new"); // old's audit row came last
    auditedInvoices = invoiceRows(
      { id: "inv_old", created_at: "2026-11-01T00:00:00Z" },
      { id: "inv_new", created_at: "2026-11-02T00:00:00Z" }
    );

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res.ok).toBe(true);
    expect(keyOfLastCall()).toBe("work-order-invoice:wo_9:inv_new");
  });

  it("a created_at tie goes to the link", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_B" }, error: null });
    linkedStatusSingle.mockResolvedValue({
      data: { status: "void", created_at: "2026-11-03T00:00:00Z" },
      error: null
    });
    auditResult = auditTargets("inv_A");
    auditedInvoices = invoiceRows({ id: "inv_A", created_at: "2026-11-03T00:00:00Z" });

    await createInvoiceForUser(WO_INPUT);

    expect(keyOfLastCall()).toBe("work-order-invoice:wo_9:inv_B");
  });

  it("refuses before Stripe when an audited billed invoice is not void", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_A" }, error: null });
    auditResult = auditTargets("inv_B");
    auditedInvoices = invoiceRows({
      id: "inv_B",
      created_at: "2026-11-04T00:00:00Z",
      status: "open"
    });

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res).toEqual({ ok: false, error: alreadyInvoicedMessage("inv_B") });
    expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
    expect(createHostedInvoice).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["the audit read errors", () => ({ data: null, error: { message: "db down" } })],
    ["an audit row has no target id", () => auditTargets("inv_B", null)]
  ])("fails closed before Stripe when %s", async (_label, makeResult) => {
    auditResult = makeResult();

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res).toEqual({
      ok: false,
      error: "Unable to read the work order's billing history"
    });
    expect(getOrCreateStripeCustomer).not.toHaveBeenCalled();
    expect(createHostedInvoice).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["errors", () => ({ data: null, error: { message: "db down" } })],
    [
      "has no created_at",
      () => ({ data: [{ id: "inv_B", status: "void" }], error: null })
    ]
  ])("fails closed before Stripe when the audited invoices read %s", async (_label, makeResult) => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_A" }, error: null });
    auditResult = auditTargets("inv_B");
    auditedInvoices = makeResult();

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res).toEqual({
      ok: false,
      error: "Unable to read the work order's billing history"
    });
    expect(createHostedInvoice).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed before Stripe when the linked invoice has no created_at and an audited one exists", async () => {
    workOrderSingle.mockResolvedValue({ data: { invoice_id: "inv_B" }, error: null });
    linkedStatusSingle.mockResolvedValue({ data: { status: "void" }, error: null });
    auditResult = auditTargets("inv_A");
    auditedInvoices = invoiceRows({ id: "inv_A", created_at: "2026-11-02T00:00:00Z" });

    const res = await createInvoiceForUser(WO_INPUT);

    expect(res).toEqual({
      ok: false,
      error: "Unable to read the work order's billing history"
    });
    expect(createHostedInvoice).not.toHaveBeenCalled();
  });

  it("no audit rows and an unlinked work order keep the v1 key", async () => {
    const res = await createInvoiceForUser(WO_INPUT);

    expect(res.ok).toBe(true);
    expect(createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "work-order-invoice:wo_9:v1" })
    );
  });

  it("without a work_order_id: no audit read", async () => {
    await createInvoiceForUser(BASE_INPUT);

    expect(auditSelect).not.toHaveBeenCalled();
  });

  it("workOrderInvoiceIdempotencyKey: v1 when nothing is replaced, else the replaced id", () => {
    expect(workOrderInvoiceIdempotencyKey("wo_9", null)).toBe("work-order-invoice:wo_9:v1");
    expect(workOrderInvoiceIdempotencyKey("wo_9", "inv_void_1")).toBe(
      "work-order-invoice:wo_9:inv_void_1"
    );
  });
});
