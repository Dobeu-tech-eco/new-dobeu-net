/**
 * Stripe webhook handler tests.
 *
 * Mocks lib/stripe (signature verify), lib/resend (email), and the admin
 * Supabase client. Exercises:
 *   - invalid signature → 400
 *   - duplicate event.id → 200 deduped (no DB writes)
 *   - invoice.paid       → updates row to paid + sends client receipt
 *   - invoice.payment_failed → updates row to overdue + sends admin alert
 *   - paid then a later payment_failed stays paid (no downgrade, no second email)
 *   - duplicate paid / payment_failed with distinct event ids do not resend
 *   - invoice.finalized  → mirrors hosted_invoice_url
 *   - invoice.voided     → status='void', and does not replace paid
 *   - unknown event type → 200 ignored (no DB writes)
 *   - handler error      → 500 + event removed from dedupe so retry works
 *   - Datadog failure logging (bad signature, handler/DB error) with no
 *     payload, signature header or webhook secret in the log args
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { after } from "next/server";

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
    filters?: Array<
      | { op: "eq" | "neq"; col: string; val: string }
      | { op: "in"; col: string; val: readonly string[] }
    >;
  }> = [];
  const adminBehavior = {
    updatedRow: null as null | {
      id: string;
      project_id: string;
      amount_cents: number;
      currency: string | null;
      status: string;
    },
    // When set, update filters are applied to these rows. Null keeps the
    // legacy stub: maybeSingle returns updatedRow and ignores filters.
    invoiceRows: null as null | Array<{
      id: string;
      project_id: string;
      amount_cents: number;
      currency: string | null;
      status: string;
      stripe_invoice_id: string;
    }>,
    updateError: null as null | { message: string; code?: string },
    throwOnUpdate: false,
    insertError: null as null | { message: string; code?: string }
  };
  const afterCallbacks: unknown[] = [];
  return { verifyMock, sendEmailMock, logMock, logErrorMock, adminInvocations, adminBehavior, afterCallbacks };
});

vi.mock("@/lib/stripe", () => ({
  verifyWebhookSignature: h.verifyMock
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: vi.fn((cb: unknown) => {
    h.afterCallbacks.push(cb);
  }),
}));

async function flushAfter() {
  const cbs = h.afterCallbacks.splice(0);
  for (const cb of cbs) await (typeof cb === "function" ? cb() : cb);
}

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
          const filters: Array<
            | { op: "eq" | "neq"; col: string; val: string }
            | { op: "in"; col: string; val: readonly string[] }
          > = [{ op: "eq", col, val }];
          h.adminInvocations.push({ table, op: "update", payload, where: { col, val }, filters });
          const apply = () => {
            if (h.adminBehavior.throwOnUpdate) return Promise.reject(new Error("db down"));
            if (h.adminBehavior.updateError) {
              return Promise.resolve({ data: null, error: h.adminBehavior.updateError });
            }
            const rows = table === "invoices" ? h.adminBehavior.invoiceRows : null;
            if (rows) {
              const matched = rows.filter((row) =>
                filters.every((f) => {
                  const value =
                    f.col === "stripe_invoice_id"
                      ? row.stripe_invoice_id
                      : f.col === "status"
                        ? row.status
                        : f.col === "id"
                          ? row.id
                          : undefined;
                  if (f.op === "eq") return value === f.val;
                  if (f.op === "neq") return value !== f.val;
                  return typeof value === "string" && f.val.includes(value);
                })
              );
              if (payload && typeof payload === "object") {
                for (const row of matched) Object.assign(row, payload);
              }
              const source = matched[0];
              return Promise.resolve({
                data: source
                  ? {
                      id: source.id,
                      project_id: source.project_id,
                      amount_cents: source.amount_cents,
                      currency: source.currency,
                      status: source.status
                    }
                  : null,
                error: null
              });
            }
            return Promise.resolve({ data: h.adminBehavior.updatedRow, error: null });
          };
          const terminal = {
            select: () => ({
              maybeSingle: () => apply()
            }),
            then: (
              onF: (v: { data: null; error: { message: string; code?: string } | null }) => unknown,
              onR?: (e: unknown) => unknown
            ) => apply().then((result) => onF({ data: null, error: result.error }), onR)
          };
          return {
            ...terminal,
            // One status guard after .eq(). With invoiceRows set, it decides
            // whether the simulated row changes; otherwise filters are recorded
            // and maybeSingle still returns updatedRow.
            neq: (filterCol: string, filterVal: string) => {
              filters.push({ op: "neq", col: filterCol, val: filterVal });
              return terminal;
            },
            in: (filterCol: string, filterVal: readonly string[]) => {
              filters.push({ op: "in", col: filterCol, val: [...filterVal] });
              return terminal;
            }
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
  h.afterCallbacks.length = 0;
  vi.clearAllMocks();
  h.adminInvocations.length = 0;
  h.adminBehavior.updatedRow = null;
  h.adminBehavior.invoiceRows = null;
  h.adminBehavior.updateError = null;
  h.adminBehavior.throwOnUpdate = false;
  h.adminBehavior.insertError = null;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
});

function seedInvoice(status: string) {
  h.adminBehavior.invoiceRows = [
    {
      id: "inv_seq",
      project_id: "p_1",
      amount_cents: 5000,
      currency: "USD",
      status,
      stripe_invoice_id: "in_seq"
    }
  ];
}

function currentStatus(): string | undefined {
  return h.adminBehavior.invoiceRows?.[0]?.status;
}

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

  describe("monotonic status", () => {
    // Distinct event ids: the in-memory LRU would drop a same-id redelivery
    // before the UPDATE. These cover the cross-instance / out-of-order case.
    it("keeps a paid invoice paid when payment_failed arrives later", async () => {
      seedInvoice("open");
      h.verifyMock
        .mockReturnValueOnce({
          id: "evt_paid_first",
          type: "invoice.paid",
          data: {
            object: {
              id: "in_seq",
              customer_email: "client@example.com",
              description: "Retainer"
            }
          }
        })
        .mockReturnValueOnce({
          id: "evt_failed_late",
          type: "invoice.payment_failed",
          data: { object: { id: "in_seq", amount_due: 5000, currency: "usd" } }
        });
      const { POST } = await importRouteFresh();

      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(currentStatus()).toBe("paid");
      expect(h.sendEmailMock).toHaveBeenCalledTimes(1);
      expect(h.sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: "client@example.com" })
      );

      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(currentStatus()).toBe("paid");
      expect(h.sendEmailMock).toHaveBeenCalledTimes(1);
      expect(h.sendEmailMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringMatching(/Payment failed/i) })
      );

      const overdueUpdate = h.adminInvocations.find(
        (call) =>
          call.op === "update" &&
          (call.payload as { status?: string } | undefined)?.status === "overdue"
      );
      expect(overdueUpdate?.filters).toEqual([
        { op: "eq", col: "stripe_invoice_id", val: "in_seq" },
        { op: "in", col: "status", val: ["open"] }
      ]);
    });

    it("does not resend when payment_failed is delivered twice under different event ids", async () => {
      seedInvoice("open");
      h.verifyMock
        .mockReturnValueOnce({
          id: "evt_fail_1",
          type: "invoice.payment_failed",
          data: { object: { id: "in_seq", amount_due: 5000, currency: "usd" } }
        })
        .mockReturnValueOnce({
          id: "evt_fail_2",
          type: "invoice.payment_failed",
          data: { object: { id: "in_seq", amount_due: 5000, currency: "usd" } }
        });
      const { POST } = await importRouteFresh();

      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(currentStatus()).toBe("overdue");
      expect(h.sendEmailMock).toHaveBeenCalledTimes(1);
      expect(h.sendEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringMatching(/Payment failed/i) })
      );

      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(currentStatus()).toBe("overdue");
      expect(h.sendEmailMock).toHaveBeenCalledTimes(1);
    });

    it("does not resend when invoice.paid is delivered twice under different event ids", async () => {
      seedInvoice("open");
      const paid = {
        type: "invoice.paid" as const,
        data: { object: { id: "in_seq", customer_email: "client@example.com" } }
      };
      h.verifyMock
        .mockReturnValueOnce({ id: "evt_paid_1", ...paid })
        .mockReturnValueOnce({ id: "evt_paid_2", ...paid });
      const { POST } = await importRouteFresh();

      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(currentStatus()).toBe("paid");
      expect(h.sendEmailMock).toHaveBeenCalledTimes(1);

      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(currentStatus()).toBe("paid");
      expect(h.sendEmailMock).toHaveBeenCalledTimes(1);
      const paidUpdates = h.adminInvocations.filter(
        (call) =>
          call.op === "update" &&
          (call.payload as { status?: string } | undefined)?.status === "paid"
      );
      expect(paidUpdates).toHaveLength(2);
      expect(paidUpdates[0]?.filters).toEqual([
        { op: "eq", col: "stripe_invoice_id", val: "in_seq" },
        { op: "in", col: "status", val: ["open", "overdue"] }
      ]);
    });

    it("still advances an overdue invoice when payment succeeds afterwards", async () => {
      seedInvoice("open");
      h.verifyMock
        .mockReturnValueOnce({
          id: "evt_fail_then",
          type: "invoice.payment_failed",
          data: { object: { id: "in_seq", amount_due: 5000, currency: "usd" } }
        })
        .mockReturnValueOnce({
          id: "evt_paid_after",
          type: "invoice.paid",
          data: { object: { id: "in_seq", customer_email: "client@example.com" } }
        });
      const { POST } = await importRouteFresh();

      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(currentStatus()).toBe("overdue");
      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(currentStatus()).toBe("paid");
      expect(h.sendEmailMock).toHaveBeenCalledTimes(2);
    });

    it("does not replace a paid invoice when a void event arrives later", async () => {
      seedInvoice("paid");
      h.verifyMock.mockReturnValue({
        id: "evt_void_late",
        type: "invoice.voided",
        data: { object: { id: "in_seq" } }
      });
      const { POST } = await importRouteFresh();
      expect((await POST(makeRequest("{}"))).status).toBe(200);
      expect(currentStatus()).toBe("paid");
      expect(h.sendEmailMock).not.toHaveBeenCalled();
    });
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


    // stdout/stderr are drained to Datadog too: capture every console call.
    let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];
    beforeEach(() => {
      consoleSpies = (["error", "warn", "log", "info"] as const).map((m) =>
        vi.spyOn(console, m).mockImplementation(() => undefined)
      );
    });
    afterEach(() => {
      for (const spy of consoleSpies) spy.mockRestore();
    });
    function consoleDump(): string {
      return JSON.stringify(
        consoleSpies.map((spy) =>
          spy.mock.calls.map((args: unknown[]) =>
            args.map((a: unknown) => (a instanceof Error ? `${a.name}: ${a.message}\n${a.stack}` : a))
          )
        )
      );
    }

    /** Datadog intake args + every console call. */
    function datadogDump(): string {
      return JSON.stringify([h.logMock.mock.calls, h.logErrorMock.mock.calls]) + consoleDump();
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
      expect(vi.mocked(after)).toHaveBeenCalledTimes(1);
      expect(h.logMock).not.toHaveBeenCalled();
      await flushAfter();
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

    it("logs a failed receipt email without the provider error text", async () => {
      h.verifyMock.mockReturnValue({
        id: "evt_mail_fail",
        type: "invoice.paid",
        data: { object: { id: "in_mail", customer_email: "payer@example.com" } }
      });
      h.adminBehavior.updatedRow = {
        id: "inv_mail",
        project_id: "p_1",
        amount_cents: 1000,
        currency: "USD",
        status: "paid"
      };
      h.sendEmailMock.mockRejectedValueOnce(new Error("Resend rejected payer@example.com"));
      const { POST } = await importRouteFresh();
      expect((await POST(makeRequest(RAW_BODY, SIG))).status).toBe(200);
      const dump = datadogDump();
      expect(dump).toContain("stripe_invoice_paid_email_failed");
      expect(dump).not.toContain("payer@example.com");
      expect(dump).not.toContain("Resend rejected");
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
