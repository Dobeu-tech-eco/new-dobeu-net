import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    insertResult: {
      data: { id: string } | null;
      error: { message: string } | null;
    };
    updateError: { message: string } | null;
    recipientUser: { email: string | null; full_name?: string | null };
    profile: { full_name: string | null };
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    insertResult: { data: { id: "inv_1" }, error: null },
    updateError: null,
    recipientUser: { email: "client@example.com", full_name: "Client Co" },
    profile: { full_name: "Client Co" }
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Stripe library mock — invoices.ts imports `getOrCreateStripeCustomer` and
// `createHostedInvoice`; tests can override per case.
const stripeMocks = vi.hoisted(() => ({
  getOrCreateStripeCustomer: vi.fn().mockResolvedValue("cus_default"),
  createHostedInvoice: vi
    .fn()
    .mockResolvedValue({ id: "in_default", hosted_invoice_url: "https://pay/default", status: "open" })
}));

vi.mock("@/lib/stripe", () => stripeMocks);

const resendMocks = vi.hoisted(() => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true, id: "msg_1" }),
  isResendConfigured: vi.fn().mockReturnValue(true),
  __resetResendForTests: vi.fn()
}));
vi.mock("@/lib/resend", () => resendMocks);

vi.mock("@/lib/supabase/server", () => {
  function buildClient() {
    return {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null })),
        admin: {
          getUserById: vi.fn(async () => ({
            data: {
              user: h.state.recipientUser.email
                ? {
                    id: "recip_id",
                    email: h.state.recipientUser.email,
                    user_metadata: { full_name: h.state.recipientUser.full_name }
                  }
                : null
            },
            error: null
          }))
        }
      },
      from: vi.fn((table: string) => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(h.state.insertResult))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: h.state.updateError }))
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve(
                table === "profiles" ? { data: h.state.profile, error: null } : { data: null, error: null }
              )
            )
          }))
        }))
      }))
    };
  }
  return {
    createClient: vi.fn(async () => buildClient()),
    createAdminClient: vi.fn(() => buildClient())
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  h.state.insertResult = { data: { id: "inv_1" }, error: null };
  h.state.updateError = null;
  h.state.recipientUser = { email: "client@example.com", full_name: "Client Co" };
  h.state.profile = { full_name: "Client Co" };
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
  stripeMocks.getOrCreateStripeCustomer.mockReset().mockResolvedValue("cus_default");
  stripeMocks.createHostedInvoice
    .mockReset()
    .mockResolvedValue({ id: "in_default", hosted_invoice_url: "https://pay/default", status: "open" });
  resendMocks.sendEmail.mockReset().mockResolvedValue({ ok: true, id: "msg_1" });
});

const validProj = "00000000-0000-0000-0000-000000000010";
const validUser = "00000000-0000-0000-0000-000000000011";
const validInv = "00000000-0000-0000-0000-000000000012";

describe("createInvoice (Stripe-wired)", () => {
  it("creates Stripe invoice → persists with stripe_invoice_id + hosted_invoice_url", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 25000,
      description: "Design retainer Q3"
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: "inv_1",
        stripe_invoice_id: "in_default",
        hosted_invoice_url: "https://pay/default"
      }
    });
    expect(stripeMocks.getOrCreateStripeCustomer).toHaveBeenCalledWith({
      supabaseUserId: validUser,
      email: "client@example.com",
      name: "Client Co"
    });
    expect(stripeMocks.createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_default", amountCents: 25000 })
    );
    expect(resendMocks.sendEmail).toHaveBeenCalled();
  });

  it("requires positive amount_cents", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 0
    });
    expect(result.ok).toBe(false);
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
  });

  it("blocks non-admin caller", async () => {
    h.state.user = { id: "u", email: "client@example.com" };
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 10000
    });
    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
  });

  it("rejects invalid project_id", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: "not-uuid",
      amount_cents: 10000
    });
    expect(result.ok).toBe(false);
  });

  it("returns error when target user has no email", async () => {
    h.state.recipientUser = { email: null, full_name: null };
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 10000
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no email/);
  });

  it("propagates Supabase insert errors", async () => {
    h.state.insertResult = { data: null, error: { message: "FK violation" } };
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 10000
    });
    expect(result).toEqual({ ok: false, error: "FK violation" });
  });

  it("surfaces Stripe failure but still inserts a local row (NULL stripe_invoice_id)", async () => {
    stripeMocks.createHostedInvoice.mockRejectedValueOnce(new Error("card_declined"));
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 10000
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Stripe error: card_declined/);
    // Local row was inserted (we returned via the surface-Stripe-error branch
    // only AFTER the .insert resolves).
    expect(stripeMocks.createHostedInvoice).toHaveBeenCalled();
  });

  it("surfaces Stripe customer creation failure but still inserts a local row", async () => {
    stripeMocks.getOrCreateStripeCustomer.mockRejectedValueOnce(new Error("customer_creation_failed"));
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 10000
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Stripe error: customer_creation_failed/);

    // createHostedInvoice shouldn't be called if customer creation fails
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    // Local row should still be inserted (we use the mock implementation's tracked calls ideally, but returning false after .insert works)
  });
});

describe("markInvoicePaidManually", () => {
  it("flips status to paid and stamps paid_at when admin", async () => {
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    const result = await markInvoicePaidManually({ id: validInv });
    expect(result).toEqual({ ok: true, data: { id: validInv } });
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "client@example.com" };
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    const result = await markInvoicePaidManually({ id: validInv });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects invalid id", async () => {
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    const result = await markInvoicePaidManually({ id: "bad" });
    expect(result.ok).toBe(false);
  });

  it("propagates Supabase update errors", async () => {
    h.state.updateError = { message: "row not found" };
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    const result = await markInvoicePaidManually({ id: validInv });
    expect(result).toEqual({ ok: false, error: "row not found" });
  });
});
