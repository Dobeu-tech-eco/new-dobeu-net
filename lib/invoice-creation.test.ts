import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Mocks ---------------------------------------------------------------

const getUserById = vi.fn();
const profileSingle = vi.fn();
const profileEq = vi.fn(() => ({ single: profileSingle }));
const profileSelect = vi.fn(() => ({ eq: profileEq }));
const insertSingle = vi.fn();
const insertSelect = vi.fn(() => ({ single: insertSingle }));
const insert = vi.fn(() => ({ select: insertSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { getUserById } },
    from: (table: string) =>
      table === "profiles" ? { select: profileSelect } : { insert }
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

import { createInvoiceForUser } from "@/lib/invoice-creation";

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

    expect(res).toEqual({ ok: false, error: "Stripe error: customer_creation_failed" });
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
        metadata: expect.objectContaining({ work_order_id: "wo_9", project_id: undefined })
      })
    );
  });
});
