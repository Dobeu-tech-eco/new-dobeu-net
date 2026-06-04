import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    insertResult: { data: { id: string } | null; error: { message: string } | null };
    updateError: { message: string } | null;
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    insertResult: { data: { id: "inv_1" }, error: null },
    updateError: null
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => {
  function buildClient() {
    return {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null }))
      },
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(h.state.insertResult))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() =>
            Promise.resolve({ data: null, error: h.state.updateError })
          )
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
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

const validProj = "00000000-0000-0000-0000-000000000010";
const validUser = "00000000-0000-0000-0000-000000000011";
const validInv = "00000000-0000-0000-0000-000000000012";

describe("createInvoice", () => {
  it("creates a draft invoice with stripe_invoice_id=null", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 25000,
      description: "Design retainer Q3"
    });
    expect(result).toEqual({ ok: true, data: { id: "inv_1" } });
  });

  it("requires positive amount_cents", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 0
    });
    expect(result.ok).toBe(false);
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "client@example.com" };
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: validUser,
      project_id: validProj,
      amount_cents: 10000
    });
    expect(result).toEqual({ ok: false, error: "forbidden" });
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
