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
 *   - Datadog failure logging (bad signature, handler/DB error) with no
 *     payload, signature header or webhook secret in the log args
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const verifyMock = vi.fn();
  const sendEmailMock = vi.fn(() => Promise.resolve({ ok: true }));
  const logMock = vi.fn();
  const logErrorMock = vi.fn();
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
    updateError: null as null | { message: string; code?: string },
    throwOnUpdate: false,
    insertError: null as null | { message: string; code?: string }
  };
  return { verifyMock, sendEmailMock, logMock, logErrorMock, adminInvocations, adminBehavior };
});

vi.mock("@/lib/stripe", () => ({
  verifyWebhookSignature: h.verifyMock
}));

vi.mock("@/lib/datadog-server", () => ({
  logToDatadog: h.logMock,
  logServerError: h.logErrorMock
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
          const terminal = {
            select: () => ({
              maybeSingle: () =>
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
          return {
            ...terminal,
            // The route chains .neq("status", ...) as an idempotency guard after
            // .eq(); the filter doesn't change mock behavior, just pass through.
            neq: () => terminal
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
          payment_status: "paid",
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
          payment_status: "paid",
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
          payment_status: "paid",
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
          payment_status: "paid",
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

  it.each(["invoice.paid", "invoice.payment_failed", "invoice.finalized", "invoice.voided"])(
    "%s database error returns 500 and allows retry", async (type) => {
      h.verifyMock.mockReturnValue({
        id: `evt_db_${type}`, type,
        data: { object: { id: "in_1", hosted_invoice_url: "https://pay.stripe.test/1" } }
      });
      h.adminBehavior.updateError = { message: "database unavailable" };
      const { POST } = await importRouteFresh();
      expect((await POST(makeRequest("{}"))).status).toBe(500);
      h.adminBehavior.updateError = null;
      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(h.adminInvocations).toHaveLength(2);
    }
  );

  it.each(["invoice.paid", "invoice.payment_failed"])("%s already applied sends no duplicate email", async (type) => {
    h.verifyMock.mockReturnValue({ id: `evt_already_${type}`, type, data: { object: { id: "in_1" } } });
    const { POST } = await importRouteFresh();
    expect((await POST(makeRequest("{}"))).status).toBe(200);
    expect(h.sendEmailMock).not.toHaveBeenCalled();
  });

  it.each([
    ["checkout.session.completed", "unpaid", 0],
    ["checkout.session.completed", "paid", 1],
    ["checkout.session.completed", "no_payment_required", 1],
    ["checkout.session.async_payment_succeeded", "paid", 1],
    ["checkout.session.async_payment_failed", "unpaid", 0],
    ["checkout.session.completed", undefined, 0],
  ])("%s with payment status %s makes %i grants", async (type, paymentStatus, count) => {
    h.verifyMock.mockReturnValue({
      id: "evt_settlement", type,
      data: { object: {
        id: "cs_settlement", payment_status: paymentStatus,
        metadata: { digital_asset_id: "asset_1", user_id: "user_1" }
      } }
    });
    const { POST } = await importRouteFresh();
    expect((await POST(makeRequest("{}"))).status).toBe(200);
    expect(h.adminInvocations).toHaveLength(count);
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

  describe("Datadog failure logging", () => {
    const RAW_BODY = JSON.stringify({ id: "evt_raw", customer_email: "payer@example.com" });
    const SIG = "t=1,v1=deadbeefcafe";

    function datadogDump(): string {
      return JSON.stringify([h.logMock.mock.calls, h.logErrorMock.mock.calls]);
    }

    it("logs a warn on a bad signature without payload, header, secret or Stripe error", async () => {
      h.verifyMock.mockImplementationOnce(() => {
        const err = new Error("No signatures found matching the expected signature for payload");
        Object.assign(err, { payload: RAW_BODY, header: SIG });
        throw err;
      });
      const { POST } = await importRouteFresh();
      const res = await POST(makeRequest(RAW_BODY, SIG));
      expect(res.status).toBe(400);
      expect(h.logMock).toHaveBeenCalledTimes(1);
      expect(h.logMock).toHaveBeenCalledWith("warn", "stripe_webhook_invalid_signature", {
        route: "/api/webhooks/stripe",
        request_id: "req_test_123"
      });
      expect(h.logErrorMock).not.toHaveBeenCalled();
      const dump = datadogDump();
      expect(dump).not.toContain("whsec_dummy");
      expect(dump).not.toContain("sk_test_dummy");
      expect(dump).not.toContain(SIG);
      expect(dump).not.toContain("payer@example.com");
      expect(dump).not.toContain("No signatures found");
    });

    it("logs a thrown handler error with event ids only and keeps the 500", async () => {
      h.verifyMock.mockReturnValue({
        id: "evt_log_err",
        type: "invoice.paid",
        data: { object: { id: "in_log", customer_email: "payer@example.com" } }
      });
      h.adminBehavior.throwOnUpdate = true;
      const { POST } = await importRouteFresh();
      const res = await POST(makeRequest(RAW_BODY, SIG));
      expect(res.status).toBe(500);
      expect(h.logMock).toHaveBeenCalledWith("error", "stripe_webhook_handler_error", {
        route: "/api/webhooks/stripe",
        request_id: "req_test_123",
        event_id: "evt_log_err",
        event_type: "invoice.paid",
        error: { kind: "Error" }
      });
      expect(h.logErrorMock).not.toHaveBeenCalled();
      const dump = datadogDump();
      expect(dump).not.toContain("whsec_dummy");
      expect(dump).not.toContain(SIG);
      expect(dump).not.toContain("payer@example.com");
      expect(dump).not.toContain("db down");
    });

    it("logs only the code for an invoice update (DB) error whose message has an email", async () => {
      h.verifyMock.mockReturnValue({
        id: "evt_log_upd",
        type: "invoice.voided",
        data: { object: { id: "in_upd" } }
      });
      h.adminBehavior.updateError = {
        message: "permission denied for payer@example.com",
        code: "42501"
      };
      const { POST } = await importRouteFresh();
      expect((await POST(makeRequest(RAW_BODY, SIG))).status).toBe(500);
      expect(h.logMock).toHaveBeenCalledWith(
        "error",
        "stripe_webhook_handler_error",
        expect.objectContaining({ error: { kind: "Error", code: "42501" } })
      );
      const dump = datadogDump();
      expect(dump).not.toContain("payer@example.com");
      expect(dump).not.toContain("permission denied");
    });

    it("logs code/constraint/table for an entitlement insert (DB) failure and keeps the 500", async () => {
      h.verifyMock.mockReturnValue({
        id: "evt_log_insert",
        type: "checkout.session.completed",
        data: {
          object: {
            payment_status: "paid",
            id: "cs_log_1",
            metadata: { digital_asset_id: "asset_1", user_id: "user_9" }
          }
        }
      });
      h.adminBehavior.insertError = {
        message:
          'insert or update on table "asset_entitlements" violates foreign key constraint "asset_entitlements_user_id_fkey" (buyer leak@example.com)',
        code: "23503"
      };
      const { POST } = await importRouteFresh();
      const res = await POST(makeRequest(RAW_BODY, SIG));
      expect(res.status).toBe(500);
      expect(h.logMock).toHaveBeenCalledWith(
        "error",
        "stripe_webhook_handler_error",
        expect.objectContaining({
          event_id: "evt_log_insert",
          event_type: "checkout.session.completed",
          error: {
            kind: "Error",
            code: "23503",
            constraint: "asset_entitlements_user_id_fkey",
            table: "asset_entitlements"
          }
        })
      );
      const dump = datadogDump();
      expect(dump).not.toContain("leak@example.com");
      expect(dump).not.toContain("violates");
    });

    it("stays non-fatal when the logger itself throws", async () => {
      h.verifyMock.mockImplementationOnce(() => {
        throw new Error("bad sig");
      });
      h.logMock.mockRejectedValueOnce(new Error("datadog down"));
      const { POST } = await importRouteFresh();
      const res = await POST(makeRequest(RAW_BODY, SIG));
      expect(res.status).toBe(400);
    });

    it("stays on the nodejs runtime (Stripe SDK does not run on edge)", async () => {
      const mod = await importRouteFresh();
      expect(mod.runtime).toBe("nodejs");
    });

    it("does not log on a handled event", async () => {
      h.verifyMock.mockReturnValue({ id: "evt_ok", type: "invoice.voided", data: { object: { id: "in_ok" } } });
      const { POST } = await importRouteFresh();
      expect((await POST(makeRequest(RAW_BODY, SIG))).status).toBe(200);
      expect(h.logMock).not.toHaveBeenCalled();
      expect(h.logErrorMock).not.toHaveBeenCalled();
    });
  });
});
