import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const stripeMock = {
    customers: {
      search: vi.fn(),
      list: vi.fn(),
      create: vi.fn()
    },
    invoices: {
      create: vi.fn(),
      finalizeInvoice: vi.fn()
    },
    invoiceItems: {
      create: vi.fn()
    },
    webhooks: {
      constructEvent: vi.fn()
    }
  };
  // Constructor mock (must be a real `function`, not an arrow, so `new` works).
  const StripeCtor = vi.fn(function StripeMock(this: unknown) {
    return stripeMock;
  });

  const supabase = {
    profileRow: { id: "user_1", stripe_customer_id: null as string | null, full_name: "Test User" },
    updateError: null as { message: string } | null,
    readError: null as { message: string } | null
  };

  return { stripeMock, StripeCtor, supabase };
});

vi.mock("stripe", () => ({ default: h.StripeCtor }));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: h.supabase.readError ? null : h.supabase.profileRow,
              error: h.supabase.readError
            })
          )
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: h.supabase.updateError }))
      }))
    }))
  })),
  createClient: vi.fn()
}));

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
  h.supabase.profileRow = { id: "user_1", stripe_customer_id: null, full_name: "Test User" };
  h.supabase.updateError = null;
  h.supabase.readError = null;
  // Reset the singleton so each test gets a fresh constructor call.
  const mod = await import("@/lib/stripe");
  mod.__resetStripeForTests();
});

describe("getStripe", () => {
  it("throws when STRIPE_SECRET_KEY is unset", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await import("@/lib/stripe");
    expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("returns the same singleton on repeated calls", async () => {
    const { getStripe } = await import("@/lib/stripe");
    const a = getStripe();
    const b = getStripe();
    expect(a).toBe(b);
    expect(h.StripeCtor).toHaveBeenCalledTimes(1);
  });
});

describe("getOrCreateStripeCustomer (idempotent)", () => {
  it("returns the cached id without hitting Stripe when profile already has one", async () => {
    h.supabase.profileRow = {
      id: "user_1",
      stripe_customer_id: "cus_cached",
      full_name: "Cached"
    };
    const { getOrCreateStripeCustomer } = await import("@/lib/stripe");
    const id = await getOrCreateStripeCustomer({
      supabaseUserId: "user_1",
      email: "cached@example.com"
    });
    expect(id).toBe("cus_cached");
    expect(h.stripeMock.customers.search).not.toHaveBeenCalled();
    expect(h.stripeMock.customers.create).not.toHaveBeenCalled();
  });

  it("reuses an existing Stripe customer when search hits", async () => {
    h.stripeMock.customers.search.mockResolvedValueOnce({
      data: [{ id: "cus_found" }]
    });
    const { getOrCreateStripeCustomer } = await import("@/lib/stripe");
    const id = await getOrCreateStripeCustomer({
      supabaseUserId: "user_1",
      email: "exists@example.com"
    });
    expect(id).toBe("cus_found");
    expect(h.stripeMock.customers.create).not.toHaveBeenCalled();
  });

  it("creates a new Stripe customer when search misses", async () => {
    h.stripeMock.customers.search.mockResolvedValueOnce({ data: [] });
    h.stripeMock.customers.create.mockResolvedValueOnce({ id: "cus_new" });
    const { getOrCreateStripeCustomer } = await import("@/lib/stripe");
    const id = await getOrCreateStripeCustomer({
      supabaseUserId: "user_1",
      email: "fresh@example.com",
      name: "Fresh Client"
    });
    expect(id).toBe("cus_new");
    expect(h.stripeMock.customers.create).toHaveBeenCalledWith({
      email: "fresh@example.com",
      name: "Fresh Client",
      metadata: { supabase_user_id: "user_1" }
    });
  });

  it("falls back to customers.list when search throws", async () => {
    h.stripeMock.customers.search.mockRejectedValueOnce(new Error("search disabled"));
    h.stripeMock.customers.list.mockResolvedValueOnce({ data: [{ id: "cus_via_list" }] });
    const { getOrCreateStripeCustomer } = await import("@/lib/stripe");
    const id = await getOrCreateStripeCustomer({
      supabaseUserId: "user_1",
      email: "legacy@example.com"
    });
    expect(id).toBe("cus_via_list");
  });
});

describe("createHostedInvoice (finalization flow)", () => {
  it("creates draft, attaches item, finalizes, returns hosted_invoice_url", async () => {
    h.stripeMock.invoices.create.mockResolvedValueOnce({ id: "in_draft" });
    h.stripeMock.invoiceItems.create.mockResolvedValueOnce({ id: "ii_1" });
    h.stripeMock.invoices.finalizeInvoice.mockResolvedValueOnce({
      id: "in_final",
      hosted_invoice_url: "https://pay.stripe.test/abc",
      status: "open"
    });
    const { createHostedInvoice } = await import("@/lib/stripe");
    const result = await createHostedInvoice({
      customerId: "cus_x",
      amountCents: 50000,
      description: "Logo design",
      metadata: { work_order_id: "wo_1", drop_me: undefined }
    });
    expect(result).toEqual({
      id: "in_final",
      hosted_invoice_url: "https://pay.stripe.test/abc",
      status: "open"
    });
    expect(h.stripeMock.invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_x",
        collection_method: "send_invoice",
        metadata: { work_order_id: "wo_1" }
      })
    );
    expect(h.stripeMock.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ invoice: "in_draft", amount: 50000 })
    );
    expect(h.stripeMock.invoices.finalizeInvoice).toHaveBeenCalledWith("in_draft");
  });

  it("rejects non-positive amount", async () => {
    const { createHostedInvoice } = await import("@/lib/stripe");
    await expect(
      createHostedInvoice({ customerId: "cus_x", amountCents: 0 })
    ).rejects.toThrow(/positive integer/);
  });

  it("rejects missing customer id", async () => {
    const { createHostedInvoice } = await import("@/lib/stripe");
    await expect(
      createHostedInvoice({ customerId: "", amountCents: 100 })
    ).rejects.toThrow(/customerId/);
  });
});

describe("verifyWebhookSignature", () => {
  it("returns the parsed event when signature is valid", async () => {
    h.stripeMock.webhooks.constructEvent.mockReturnValueOnce({
      id: "evt_1",
      type: "invoice.paid"
    });
    const { verifyWebhookSignature } = await import("@/lib/stripe");
    const event = verifyWebhookSignature("rawbody", "t=1,v1=abc");
    expect(event.id).toBe("evt_1");
    expect(h.stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
      "rawbody",
      "t=1,v1=abc",
      "whsec_dummy"
    );
  });

  it("throws when signature header is absent", async () => {
    const { verifyWebhookSignature } = await import("@/lib/stripe");
    expect(() => verifyWebhookSignature("body", null)).toThrow(/missing/);
  });

  it("propagates Stripe's invalid-signature error", async () => {
    h.stripeMock.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error("Invalid signature");
    });
    const { verifyWebhookSignature } = await import("@/lib/stripe");
    expect(() => verifyWebhookSignature("body", "t=1,v1=bad")).toThrow(/Invalid signature/);
  });

  it("throws when STRIPE_WEBHOOK_SECRET is unset", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { verifyWebhookSignature } = await import("@/lib/stripe");
    expect(() => verifyWebhookSignature("body", "sig")).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });
});
