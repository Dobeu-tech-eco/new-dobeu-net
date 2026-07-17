/**
 * Stripe webhook handler tests.
 *
 * Mocks lib/stripe (signature verify), lib/resend (email), and the admin
 * Supabase client. Exercises:
 *   - invalid signature → 400
 *   - duplicate event.id → 200 deduped (no DB writes)
 *   - invoice.paid       → updates row to paid + sends client receipt
 *   - invoice.payment_failed → updates row to uncollectible + sends admin alert
 *   - invoice.finalized  → mirrors hosted_invoice_url
 *   - invoice.voided     → status='void'
 *   - unknown event type → 200 ignored (no DB writes)
 *   - handler error      → 500 + event removed from dedupe so retry works
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const verifyMock = vi.fn();
  const sendEmailMock = vi.fn(() => Promise.resolve({ ok: true }));
  const adminInvocations: Array<{
    table: string;
    op: string;
    payload?: unknown;
    where?: { col: string; val: string };
  }> = [];
  const adminBehavior = {
    updatedRow: null as null | {
      id: string;
      project_id: string;
      amount_cents: number;
      currency: string | null;
      status: string;
    },
    updateError: null as null | { message: string },
    throwOnUpdate: false,
    insertError: null as null | { message: string; code?: string }
  };
  return { verifyMock, sendEmailMock, adminInvocations, adminBehavior };
});

vi.mock("@/lib/stripe", () => ({
  verifyWebhookSignature: h.verifyMock
}));

vi.mock("@/lib/resend", () => ({
  sendEmail: h.sendEmailMock,
  isResendConfigured: () => true
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: (payload: unknown) => ({
        eq: (col: string, val: string) => {
          h.adminInvocations.push({ table, op: "update", payload, where: { col, val } });
          const rejectIfNeeded = <T,>(value: T): Promise<T> =>
            h.adminBehavior.throwOnUpdate
              ? Promise.reject(new Error("db down"))
              : Promise.resolve(value);
          return {
            select: () => ({
              single: () =>
                rejectIfNeeded({
                  data: h.adminBehavior.updatedRow,
                  error: h.adminBehavior.updateError
                })
            }),
            then: (
              onF: (v: { data: null; error: { message: string } | null }) => unknown,
              onR?: (e: unknown) => unknown
            ) =>
              rejectIfNeeded({ data: null, error: h.adminBehavior.updateError }).then(onF, onR)
          };
        }
      }),
      insert: (payload: unknown) => {
        h.adminInvocations.push({ table, op: "insert", payload });
        const settle = () =>
          h.adminBehavior.throwOnUpdate
            ? Promise.reject(new Error("db down"))
            : Promise.resolve({ data: null, error: h.adminBehavior.insertError });
        return {
          then: (
            onF: (v: { data: null; error: { message: string } | null }) => unknown,
            onR?: (e: unknown) => unknown
          ) => settle().then(onF, onR)
        };
      }
    })
  }),
  createClient: vi.fn()
}));

async function importRouteFresh() {
  vi.resetModules();
  const mod = await import("./route");
  const dedupe = await import("@/lib/stripe-event-dedupe");
  dedupe.__resetSeenStripeEventsForTests();
  return mod;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.adminInvocations.length = 0;
  h.adminBehavior.updatedRow = null;
  h.adminBehavior.updateError = null;
  h.adminBehavior.throwOnUpdate = false;
  h.adminBehavior.insertError = null;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
});

function makeRequest(body: string, sig: string | null = "t=1,v1=ok"): Request {
  const headers = new Headers();
  if (sig) headers.set("stripe-signature", sig);
  headers.set("stripe-request-id", "req_test_123");
  return new Request("https://dobeu.net/api/webhooks/stripe", {
    method: "POST",
    body,
    headers
  });
}

describe("POST /api/webhooks/stripe", () => {
  it("returns 400 on invalid signature", async () => {
    h.verifyMock.mockImplementationOnce(() => {
      throw new Error("bad sig");
    });
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}", "t=1,v1=bad"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_signature");
    expect(h.adminInvocations).toHaveLength(0);
  });

  it("returns 200 deduped on duplicate event.id without re-running handler", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_dup",
      type: "invoice.paid",
      data: { object: { id: "in_1", customer_email: "x@y.z" } }
    });
    h.adminBehavior.updatedRow = {
      id: "inv_1",
      project_id: "p_1",
      amount_cents: 5000,
      currency: "USD",
      status: "paid"
    };
    const { POST } = await importRouteFresh();
    const first = await POST(makeRequest("{}"));
    expect(first.status).toBe(200);
    const beforeCount = h.adminInvocations.length;

    const second = await POST(makeRequest("{}"));
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.deduped).toBe(true);
    expect(h.adminInvocations).toHaveLength(beforeCount);
  });

  it("invoice.paid → updates row to paid + sends client receipt", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_paid",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_paid_1",
          customer_email: "client@example.com",
          description: "Logo design"
        }
      }
    });
    h.adminBehavior.updatedRow = {
      id: "inv_77",
      project_id: "p_1",
      amount_cents: 12500,
      currency: "USD",
      status: "paid"
    };
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);

    expect(h.adminInvocations).toHaveLength(1);
    expect(h.adminInvocations[0].table).toBe("invoices");
    expect(h.adminInvocations[0].payload).toMatchObject({ status: "paid" });
    expect(h.adminInvocations[0].where).toEqual({ col: "stripe_invoice_id", val: "in_paid_1" });

    expect(h.sendEmailMock).toHaveBeenCalledTimes(1);
    expect(h.sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "client@example.com" })
    );
  });

  it("invoice.payment_failed → overdue + admin alert", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_fail_1",
          amount_due: 4500,
          currency: "usd"
        }
      }
    });
    h.adminBehavior.updatedRow = {
      id: "inv_88",
      project_id: "p_1",
      amount_cents: 4500,
      currency: "USD",
      status: "overdue"
    };
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);

    expect(h.adminInvocations[0].payload).toMatchObject({ status: "overdue" });
    expect(h.sendEmailMock).toHaveBeenCalledTimes(1);
    expect(h.sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringMatching(/Payment failed/i) })
    );
  });

  it("invoice.finalized → mirrors hosted_invoice_url only", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_final",
      type: "invoice.finalized",
      data: {
        object: {
          id: "in_final_1",
          hosted_invoice_url: "https://pay.stripe.test/abc"
        }
      }
    });
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(h.adminInvocations[0].payload).toMatchObject({
      hosted_invoice_url: "https://pay.stripe.test/abc"
    });
    expect(h.sendEmailMock).not.toHaveBeenCalled();
  });

  it("invoice.voided → status='void'", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_void",
      type: "invoice.voided",
      data: { object: { id: "in_void_1" } }
    });
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(h.adminInvocations[0].payload).toMatchObject({ status: "void" });
  });

  it("checkout.session.completed → grants a user entitlement", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_co_user",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_user_1",
          metadata: { digital_asset_id: "asset_1", user_id: "user_9" }
        }
      }
    });
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);

    expect(h.adminInvocations).toHaveLength(1);
    expect(h.adminInvocations[0].table).toBe("asset_entitlements");
    expect(h.adminInvocations[0].op).toBe("insert");
    expect(h.adminInvocations[0].payload).toMatchObject({
      asset_id: "asset_1",
      company_id: null,
      user_id: "user_9",
      source: "stripe",
      stripe_checkout_session_id: "cs_user_1"
    });
  });

  it("checkout.session.completed → company grant nulls user_id", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_co_company",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_company_1",
          metadata: { digital_asset_id: "asset_2", company_id: "co_1", user_id: "user_9" }
        }
      }
    });
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(h.adminInvocations[0].payload).toMatchObject({
      asset_id: "asset_2",
      company_id: "co_1",
      user_id: null
    });
  });

  it("checkout.session.completed without digital_asset_id → ignored, no writes", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_co_noop",
      type: "checkout.session.completed",
      data: { object: { id: "cs_noop", metadata: { user_id: "user_9" } } }
    });
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(h.adminInvocations).toHaveLength(0);
  });

  it("checkout.session.completed → unique violation is idempotent success", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_co_dupe",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_dupe_1",
          metadata: { digital_asset_id: "asset_1", user_id: "user_9" }
        }
      }
    });
    h.adminBehavior.insertError = { message: "duplicate key", code: "23505" };
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it("checkout.session.completed → non-unique insert error → 500", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_co_err",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_err_1",
          metadata: { digital_asset_id: "asset_1", user_id: "user_9" }
        }
      }
    });
    h.adminBehavior.insertError = { message: "fk violation", code: "23503" };
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(500);
  });

  it("unknown event type → 200 ignored, no DB writes", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_unknown",
      type: "customer.created",
      data: { object: {} }
    });
    const { POST } = await importRouteFresh();
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(h.adminInvocations).toHaveLength(0);
    expect(h.sendEmailMock).not.toHaveBeenCalled();
  });

  it("handler error → 500 + event removed from dedupe so retry works", async () => {
    h.verifyMock.mockReturnValue({
      id: "evt_retry",
      type: "invoice.paid",
      data: { object: { id: "in_x" } }
    });
    h.adminBehavior.throwOnUpdate = true;
    const { POST } = await importRouteFresh();
    const first = await POST(makeRequest("{}"));
    expect(first.status).toBe(500);

    // Now flip behavior to succeed; the same event.id should be processable.
    h.adminBehavior.throwOnUpdate = false;
    h.adminBehavior.updatedRow = {
      id: "inv_1",
      project_id: "p_1",
      amount_cents: 1000,
      currency: "USD",
      status: "paid"
    };
    const second = await POST(makeRequest("{}"));
    expect(second.status).toBe(200);
  });
});
