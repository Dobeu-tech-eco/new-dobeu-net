import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { buildStubClient, type StubUser } from "./__test-helpers";

const h = vi.hoisted(() => ({
  cookie: null as unknown,
  admin: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Every Stripe call is mocked: no sk_ keys, no network.
const stripeMocks = vi.hoisted(() => ({
  getOrCreateStripeCustomer: vi.fn(async () => "cus_default"),
  createHostedInvoice: vi.fn(async () => ({
    id: "in_default",
    hosted_invoice_url: "https://pay/default",
    status: "open",
  })),
}));
vi.mock("@/lib/stripe", () => stripeMocks);

const resendMocks = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => ({ ok: true, id: "msg_1" })),
}));
vi.mock("@/lib/resend", () => resendMocks);

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.cookie),
  createAdminClient: vi.fn(() => h.admin),
}));

const ADMIN = { id: "admin_id", email: "admin@dobeu.net" };
const VALID_USER = "00000000-0000-0000-0000-000000000011";
const VALID_PROJ = "00000000-0000-0000-0000-000000000010";
const VALID_INV = "00000000-0000-0000-0000-000000000012";
const VALID_WO = "00000000-0000-0000-0000-000000000013";

function arrange(
  options: {
    user?: StubUser | null;
    level?: "aal1" | "aal2";
    recipientEmail?: string | null;
    recipientName?: string | null;
    profileName?: string | null;
    invoiceStatus?: string | null;
    invoiceReadError?: { message: string };
    insert?: { data?: unknown; error?: { message: string } | null };
    updateError?: { message: string };
    auditError?: { message: string };
    // Rows the unsent-duplicate guard finds (default none) / its read error.
    unsentInvoices?: unknown[];
    unsentError?: { message: string };
    // Rows / error from the work-order back-link update (default one row).
    linkRows?: unknown[] | null;
    linkError?: { message: string };
    workOrder?: Record<string, unknown> | null;
    workOrderError?: { message: string };
    project?: Record<string, unknown> | null;
    projectError?: { message: string };
    membership?: Record<string, unknown> | null;
    membershipError?: { message: string };
  } = {},
) {
  const cookie = buildStubClient({
    user:
      options.user === undefined
        ? { id: ADMIN.id, email: ADMIN.email }
        : options.user,
  });
  h.cookie = {
    ...cookie.supabase,
    auth: {
      ...cookie.supabase.auth,
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: { currentLevel: options.level ?? "aal2", nextLevel: "aal2" },
          error: null,
        })),
      },
    },
  };
  const stub = buildStubClient({
    tables: {
      profiles: {
        selectSingle: {
          data:
            options.profileName === undefined
              ? { full_name: "Client Co" }
              : options.profileName
                ? { full_name: options.profileName }
                : null,
        },
      },
      invoices: {
        selectSingle: {
          data:
            options.invoiceStatus === undefined
              ? { status: "open" }
              : options.invoiceStatus
                ? { status: options.invoiceStatus }
                : null,
          error: options.invoiceReadError,
        },
        insert: options.insert ?? { data: { id: "inv_1" } },
        update: { error: options.updateError },
      },
      work_orders: {
        update: { error: options.linkError },
        selectSingle: {
          data:
            options.workOrder === undefined
              ? {
                  id: VALID_WO,
                  created_by: VALID_USER,
                  status: "accepted",
                  project_id: VALID_PROJ,
                  quoted_amount_cents: 10000,
                  title: "Accepted work",
                  invoice_id: null,
                }
              : options.workOrder,
          error: options.workOrderError,
        },
      },
      projects: {
        selectSingle: {
          data:
            options.project === undefined
              ? {
                  id: VALID_PROJ,
                  owner_user_id: VALID_USER,
                  company_id: null,
                }
              : options.project,
          error: options.projectError,
        },
      },
      company_members: {
        selectSingle: {
          data: options.membership ?? null,
          error: options.membershipError,
        },
      },
      admin_audit_log: {
        insert: { error: options.auditError },
      },
    },
  });
  // The shared stub builder has no `.is()` (used by the conditional
  // work-order back-link); add a recording pass-through per chain. Its
  // update chains also resolve `data: null`, while real Supabase
  // `.update().select()` resolves an array — emulate a one-row update so the
  // success paths behave like production (conflict tests override this).
  type Chain = Record<string, unknown>;
  const stubFrom = stub.supabase.from as unknown as {
    getMockImplementation():
      | ((table: string) => Record<string, (...a: unknown[]) => Chain>)
      | undefined;
    mockImplementation(fn: (table: string) => unknown): unknown;
  };
  const innerImpl = stubFrom.getMockImplementation();
  if (innerImpl) {
    stubFrom.mockImplementation((table: string) => {
      const api = innerImpl(table);
      for (const key of ["insert", "update", "delete", "select"]) {
        const orig = api[key];
        api[key] = (...a: unknown[]) => {
          const chain = orig(...a);
          if (typeof chain.is !== "function") {
            chain.is = (...isArgs: unknown[]) => {
              stub.recorded.push({ table, method: "is", args: isArgs });
              return chain;
            };
          }
          if (typeof chain.gte !== "function") {
            chain.gte = (...gteArgs: unknown[]) => {
              stub.recorded.push({ table, method: "gte", args: gteArgs });
              return chain;
            };
          }
          // The duplicate guard awaits `invoices.select()` as a list (the
          // mark-paid read uses `.single()`, which is unaffected).
          if (key === "select" && table === "invoices") {
            chain.then = (resolve: (v: unknown) => void) =>
              resolve({
                data: options.unsentInvoices ?? [],
                error: options.unsentError ?? null,
              });
          }
          if (key === "update" && typeof chain.then === "function") {
            const origThen = chain.then as (
              resolve: (v: unknown) => void,
            ) => void;
            chain.then = (resolve: (v: unknown) => void) => {
              origThen((v) => {
                const val = v as { data: unknown; error: unknown };
                const rows =
                  table === "work_orders" && options.linkRows !== undefined
                    ? options.linkRows
                    : [{ id: "stub_updated_row" }];
                resolve(val.error ? val : { data: rows, error: null });
              });
            };
          }
          return chain;
        };
      }
      return api;
    });
  }
  const recipientEmail =
    options.recipientEmail === undefined
      ? "client@example.com"
      : options.recipientEmail;
  const recipientName =
    options.recipientName === undefined ? "Client Co" : options.recipientName;
  h.admin = {
    ...stub.supabase,
    auth: {
      ...stub.supabase.auth,
      admin: {
        getUserById: vi.fn(async () => ({
          data: {
            user: recipientEmail
              ? {
                  id: "recip_id",
                  email: recipientEmail,
                  user_metadata: { full_name: recipientName },
                }
              : null,
          },
          error: null,
        })),
      },
    },
  };
  return stub;
}

let admin: ReturnType<typeof arrange>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
  admin = arrange();
});

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

function auditInserts() {
  return admin.recorded.filter(
    (entry) => entry.table === "admin_audit_log" && entry.method === "insert",
  );
}

function expectNoAudit() {
  expect(auditInserts()).toEqual([]);
}

describe("createInvoice (Stripe-wired)", () => {
  it("creates a Stripe invoice, persists, emails, and audits invoice.create", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 25000,
      description: "Design retainer Q3",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        id: "inv_1",
        stripe_invoice_id: "in_default",
        hosted_invoice_url: "https://pay/default",
      },
    });
    expect(stripeMocks.getOrCreateStripeCustomer).toHaveBeenCalledWith({
      supabaseUserId: VALID_USER,
      email: "client@example.com",
      name: "Client Co",
    });
    expect(stripeMocks.createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_default", amountCents: 25000 }),
    );
    expect(resendMocks.sendEmail).toHaveBeenCalled();
    expect(auditInserts()).toHaveLength(1);
    expect(auditInserts()[0].args).toEqual([
      expect.objectContaining({
        actor_user_id: ADMIN.id,
        action: "invoice.create",
        target_type: "invoice",
        target_id: "inv_1",
      }),
    ]);
  });

  it("requires positive amount_cents without touching Stripe or the audit log", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 0,
    });
    expect(result.ok).toBe(false);
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("blocks a non-admin caller with no insert and no audit", async () => {
    admin = arrange({ user: { id: "u", email: "client@example.com" } });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 10000,
    });
    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(
      admin.recorded.filter((entry) => entry.method === "insert"),
    ).toEqual([]);
    expectNoAudit();
  });

  it("propagates mfa_required without touching Stripe", async () => {
    admin = arrange({ level: "aal1" });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect(
      await createInvoice({
        user_id: VALID_USER,
        project_id: VALID_PROJ,
        amount_cents: 10000,
      }),
    ).toEqual({ ok: false, error: "mfa_required" });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("returns an error when the target user has no email", async () => {
    admin = arrange({ recipientEmail: null, profileName: null });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 10000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no email/);
    expectNoAudit();
  });

  it("propagates Supabase insert errors without auditing", async () => {
    admin = arrange({ insert: { data: null, error: { message: "FK violation" } } });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect(
      await createInvoice({
        user_id: VALID_USER,
        project_id: VALID_PROJ,
        amount_cents: 10000,
      }),
    ).toEqual({ ok: false, error: "FK violation" });
    expectNoAudit();
  });

  it("creates an invoice with no project and audits project_id null", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      amount_cents: 10000,
    });
    expect(result.ok).toBe(true);
    expect(auditInserts()).toHaveLength(1);
    expect(auditInserts()[0].args).toEqual([
      expect.objectContaining({
        action: "invoice.create",
        data: expect.objectContaining({ project_id: null }),
      }),
    ]);
  });

  it("links the work order with a conditional back-link on success", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 10000,
      work_order_id: VALID_WO,
    });
    expect(result.ok).toBe(true);
    expect(admin.recorded).toContainEqual({
      table: "work_orders",
      method: "update",
      args: [expect.objectContaining({ invoice_id: "inv_1" })],
    });
    expect(admin.recorded).toContainEqual({
      table: "work_orders",
      method: "eq",
      args: ["id", VALID_WO],
    });
    expect(admin.recorded).toContainEqual({
      table: "work_orders",
      method: "is",
      args: ["invoice_id", null],
    });
    expect(auditInserts()).toHaveLength(1);
    expect(auditInserts()[0].args).toEqual([
      expect.objectContaining({
        action: "invoice.create",
        target_id: "inv_1",
      }),
    ]);
  });

  it("rejects a work order owned by another user without touching Stripe", async () => {
    admin = arrange({
      workOrder: {
        id: VALID_WO,
        created_by: "00000000-0000-0000-0000-000000000099",
        status: "accepted",
        project_id: VALID_PROJ,
        quoted_amount_cents: 10000,
        title: "Someone else's work",
        invoice_id: null,
      },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 10000,
      work_order_id: VALID_WO,
    });
    expect(result).toEqual({
      ok: false,
      error: "Work order does not belong to the recipient",
    });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("rejects an already-invoiced work order without touching Stripe", async () => {
    admin = arrange({
      workOrder: {
        id: VALID_WO,
        created_by: VALID_USER,
        status: "accepted",
        project_id: VALID_PROJ,
        quoted_amount_cents: 10000,
        title: "Accepted work",
        invoice_id: "inv_old",
      },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect(
      await createInvoice({
        user_id: VALID_USER,
        project_id: VALID_PROJ,
        amount_cents: 10000,
        work_order_id: VALID_WO,
      }),
    ).toEqual({ ok: false, error: "work order already has an invoice" });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("rejects a non-accepted work order without touching Stripe", async () => {
    admin = arrange({
      workOrder: {
        id: VALID_WO,
        created_by: VALID_USER,
        status: "open",
        project_id: VALID_PROJ,
        quoted_amount_cents: 10000,
        title: "Open work",
        invoice_id: null,
      },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 10000,
      work_order_id: VALID_WO,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatch(/can only invoice an accepted work order/);
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("rejects a project owned by someone else without touching Stripe", async () => {
    admin = arrange({
      project: {
        id: VALID_PROJ,
        owner_user_id: "00000000-0000-0000-0000-000000000099",
        company_id: null,
      },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect(
      await createInvoice({
        user_id: VALID_USER,
        project_id: VALID_PROJ,
        amount_cents: 10000,
      }),
    ).toEqual({ ok: false, error: "Project must belong to the recipient" });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("accepts a project via an active company membership", async () => {
    admin = arrange({
      project: {
        id: VALID_PROJ,
        owner_user_id: "00000000-0000-0000-0000-000000000099",
        company_id: "00000000-0000-0000-0000-000000000020",
      },
      membership: { id: "member_1" },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 10000,
    });
    expect(result.ok).toBe(true);
    expect(auditInserts()).toHaveLength(1);
  });

  it("rejects a project when the company membership is inactive", async () => {
    admin = arrange({
      project: {
        id: VALID_PROJ,
        owner_user_id: "00000000-0000-0000-0000-000000000099",
        company_id: "00000000-0000-0000-0000-000000000020",
      },
      membershipError: { message: "no rows" },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect(
      await createInvoice({
        user_id: VALID_USER,
        project_id: VALID_PROJ,
        amount_cents: 10000,
      }),
    ).toEqual({ ok: false, error: "Project must belong to the recipient" });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("surfaces a Stripe failure but still inserts a local row, auditing invoice.create_stripe_failed", async () => {
    stripeMocks.createHostedInvoice.mockRejectedValueOnce(
      new Error("card_declined"),
    );
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 10000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Stripe error: card_declined/);
    expect(stripeMocks.createHostedInvoice).toHaveBeenCalled();
    expect(auditInserts()).toHaveLength(1);
    expect(auditInserts()[0].args).toEqual([
      expect.objectContaining({
        actor_user_id: ADMIN.id,
        action: "invoice.create_stripe_failed",
        target_type: "invoice",
        target_id: "inv_1",
        data: { amount_cents: 10000, stripe_failed: true },
      }),
    ]);
  });

  it("audits invoice.create_stripe_failed on a Stripe customer failure", async () => {
    stripeMocks.getOrCreateStripeCustomer.mockRejectedValueOnce(
      new Error("customer_creation_failed"),
    );
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      project_id: VALID_PROJ,
      amount_cents: 10000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatch(/Stripe error: customer_creation_failed/);
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(auditInserts()).toHaveLength(1);
    expect(auditInserts()[0].args).toEqual([
      expect.objectContaining({ action: "invoice.create_stripe_failed" }),
    ]);
  });

  it("rejects a recent unsent same-amount invoice for the client without touching Stripe", async () => {
    admin = arrange({ unsentInvoices: [{ id: "inv_unsent" }] });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      amount_cents: 10000,
    });
    expect(result).toEqual({
      ok: false,
      error:
        "An unsent invoice for this client and amount already exists from the last 24 hours (Stripe failed). Check the Stripe configuration, then void that invoice in Supabase (status = void) before creating another.",
    });
    const eqs = admin.recorded.filter(
      (e) => e.table === "invoices" && e.method === "eq",
    );
    expect(eqs).toContainEqual(expect.objectContaining({ args: ["user_id", VALID_USER] }));
    expect(eqs).toContainEqual(expect.objectContaining({ args: ["amount_cents", 10000] }));
    expect(admin.recorded).toContainEqual({
      table: "invoices",
      method: "is",
      args: ["stripe_invoice_id", null],
    });
    expect(admin.recorded).toContainEqual({
      table: "invoices",
      method: "in",
      args: ["status", ["open"]],
    });
    expect(
      admin.recorded.filter((e) => e.table === "invoices" && e.method === "gte"),
    ).toEqual([
      { table: "invoices", method: "gte", args: ["created_at", expect.any(String)] },
    ]);
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(
      admin.recorded.filter((e) => e.table === "invoices" && e.method === "insert"),
    ).toEqual([]);
    expectNoAudit();
  });

  it("fails closed when the duplicate-guard read errors", async () => {
    admin = arrange({ unsentError: { message: "db down" } });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      amount_cents: 10000,
    });
    expect(result).toEqual({
      ok: false,
      error: "Unable to check for duplicate invoices",
    });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
  });

  it.each([
    ["a zero-row update", { linkRows: [] }],
    ["a null update result", { linkRows: null }],
    ["an update error", { linkError: { message: "boom" } }],
  ])(
    "flags linkFailed (invoice kept) and audits invoice.link_failed on %s",
    async (_name, opts) => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      admin = arrange(opts);
      try {
        const { createInvoice } = await import("@/lib/actions/invoices");
        const result = await createInvoice({
          user_id: VALID_USER,
          project_id: VALID_PROJ,
          amount_cents: 10000,
          work_order_id: VALID_WO,
        });
        expect(result).toEqual({
          ok: true,
          data: {
            id: "inv_1",
            stripe_invoice_id: "in_default",
            hosted_invoice_url: "https://pay/default",
            linkFailed: true,
          },
        });
        expect(admin.recorded).toContainEqual({
          table: "work_orders",
          method: "select",
          args: ["id"],
        });
        expect(auditInserts().map((e) => e.args)).toEqual([
          [
            expect.objectContaining({
              action: "invoice.link_failed",
              target_type: "invoice",
              target_id: "inv_1",
              data: { work_order_id: VALID_WO },
            }),
          ],
          [expect.objectContaining({ action: "invoice.create", target_id: "inv_1" })],
        ]);
      } finally {
        consoleError.mockRestore();
      }
    },
  );

  it("keeps primary success when the audit insert fails (non-fatal)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    admin = arrange({
      auditError: { message: "private database details" } as {
        message: string;
      },
    });
    try {
      const { createInvoice } = await import("@/lib/actions/invoices");
      const result = await createInvoice({
        user_id: VALID_USER,
        project_id: VALID_PROJ,
        amount_cents: 10000,
      });
      expect(result.ok).toBe(true);
      expect(auditInserts()).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(
        "[invoices] audit log insert failed (non-fatal):",
        undefined,
      );
      expect(revalidatePath).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("createInvoiceForWorkOrder", () => {
  it("invoices an accepted work order and audits invoice.create_for_work_order", async () => {
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    const result = await createInvoiceForWorkOrder({ work_order_id: VALID_WO });
    expect(result.ok).toBe(true);
    expect(auditInserts()).toHaveLength(1);
    expect(auditInserts()[0].args).toEqual([
      expect.objectContaining({
        actor_user_id: ADMIN.id,
        action: "invoice.create_for_work_order",
        target_type: "invoice",
      }),
    ]);
  });

  it("rejects an already-invoiced work order without auditing", async () => {
    admin = arrange({
      workOrder: {
        id: VALID_WO,
        created_by: VALID_USER,
        status: "accepted",
        project_id: VALID_PROJ,
        quoted_amount_cents: 10000,
        title: "Accepted work",
        invoice_id: "inv_old",
      },
    });
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    expect(
      await createInvoiceForWorkOrder({ work_order_id: VALID_WO }),
    ).toEqual({ ok: false, error: "work order already has an invoice" });
    expectNoAudit();
  });

  it("rejects a non-accepted work order without auditing", async () => {
    admin = arrange({
      workOrder: {
        id: VALID_WO,
        created_by: VALID_USER,
        status: "open",
        project_id: VALID_PROJ,
        quoted_amount_cents: 10000,
        title: "Open work",
        invoice_id: null,
      },
    });
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    const result = await createInvoiceForWorkOrder({ work_order_id: VALID_WO });
    expect(result.ok).toBe(false);
    expectNoAudit();
  });

  it("blocks a non-admin caller without auditing", async () => {
    admin = arrange({ user: { id: "u", email: "client@example.com" } });
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    expect(
      await createInvoiceForWorkOrder({ work_order_id: VALID_WO }),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(createAdminClient).not.toHaveBeenCalled();
    expectNoAudit();
  });
});

describe("markInvoicePaidManually", () => {
  it.each(["open", "overdue"])(
    "flips a %s invoice to paid and audits with the previous status",
    async (status) => {
      admin = arrange({ invoiceStatus: status });
      const { markInvoicePaidManually } = await import(
        "@/lib/actions/invoices"
      );
      expect(await markInvoicePaidManually({ id: VALID_INV })).toEqual({
        ok: true,
        data: { id: VALID_INV },
      });
      expect(admin.recorded).toContainEqual({
        table: "invoices",
        method: "update",
        args: [expect.objectContaining({ status: "paid" })],
      });
      expect(admin.recorded).toContainEqual({
        table: "invoices",
        method: "in",
        args: ["status", ["open", "overdue"]],
      });
      expect(auditInserts()).toHaveLength(1);
      expect(auditInserts()[0].args).toEqual([
        expect.objectContaining({
          actor_user_id: ADMIN.id,
          action: "invoice.mark_paid_manual",
          target_type: "invoice",
          target_id: VALID_INV,
          data: { previous_status: status, status: "paid" },
        }),
      ]);
    },
  );

  it("rejects an already-paid invoice without updating or auditing", async () => {
    admin = arrange({ invoiceStatus: "paid" });
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    expect(await markInvoicePaidManually({ id: VALID_INV })).toEqual({
      ok: false,
      error: "invoice already paid",
    });
    expect(
      admin.recorded.filter(
        (entry) => entry.table === "invoices" && entry.method === "update",
      ),
    ).toEqual([]);
    expectNoAudit();
  });

  it("rejects a void invoice without updating or auditing", async () => {
    admin = arrange({ invoiceStatus: "void" });
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    expect(await markInvoicePaidManually({ id: VALID_INV })).toEqual({
      ok: false,
      error: "invoice is void",
    });
    expect(
      admin.recorded.filter(
        (entry) => entry.table === "invoices" && entry.method === "update",
      ),
    ).toEqual([]);
    expectNoAudit();
  });

  it("treats zero updated rows as a conflict", async () => {
    admin = arrange({ invoiceStatus: "open" });
    // Force the conditional update to match nothing: an empty rowset.
    type Updater = (...args: unknown[]) => {
      then: (resolve: (value: unknown) => void) => void;
    };
    const innerFrom = (h.admin as { from: (table: string) => { update: Updater } })
      .from;
    (h.admin as { from: unknown }).from = vi.fn((table: string) => {
      const query = innerFrom(table);
      if (table === "invoices") {
        const origUpdate = query.update;
        query.update = (...args: unknown[]) => {
          const chain = origUpdate(...args);
          chain.then = (resolve) => resolve({ data: [], error: null });
          return chain;
        };
      }
      return query;
    });
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    expect(await markInvoicePaidManually({ id: VALID_INV })).toEqual({
      ok: false,
      error: "invoice is no longer payable",
    });
    expectNoAudit();
  });

  it("treats a null update result as a conflict", async () => {
    admin = arrange({ invoiceStatus: "open" });
    type Updater = (...args: unknown[]) => {
      then: (resolve: (value: unknown) => void) => void;
    };
    const innerFrom = (h.admin as { from: (table: string) => { update: Updater } })
      .from;
    (h.admin as { from: unknown }).from = vi.fn((table: string) => {
      const query = innerFrom(table);
      if (table === "invoices") {
        const origUpdate = query.update;
        query.update = (...args: unknown[]) => {
          const chain = origUpdate(...args);
          chain.then = (resolve) => resolve({ data: null, error: null });
          return chain;
        };
      }
      return query;
    });
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    expect(await markInvoicePaidManually({ id: VALID_INV })).toEqual({
      ok: false,
      error: "invoice is no longer payable",
    });
    expectNoAudit();
  });

  it("blocks a non-admin caller with no update and no audit", async () => {
    admin = arrange({ user: { id: "u", email: "client@example.com" } });
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    expect(await markInvoicePaidManually({ id: VALID_INV })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(
      admin.recorded.filter((entry) => entry.method === "update"),
    ).toEqual([]);
    expectNoAudit();
  });

  it("propagates mfa_required with no update and no audit", async () => {
    admin = arrange({ level: "aal1" });
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    expect(await markInvoicePaidManually({ id: VALID_INV })).toEqual({
      ok: false,
      error: "mfa_required",
    });
    expectNoAudit();
  });

  it("rejects an invalid id before touching the database", async () => {
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    expect((await markInvoicePaidManually({ id: "bad" })).ok).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("propagates Supabase update errors without auditing", async () => {
    admin = arrange({ invoiceStatus: "open", updateError: { message: "row not found" } });
    const { markInvoicePaidManually } = await import("@/lib/actions/invoices");
    expect(await markInvoicePaidManually({ id: VALID_INV })).toEqual({
      ok: false,
      error: "row not found",
    });
    expectNoAudit();
  });

  it("keeps primary success when the audit insert fails (non-fatal)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    admin = arrange({
      invoiceStatus: "open",
      auditError: { message: "private database details" } as {
        message: string;
      },
    });
    try {
      const { markInvoicePaidManually } = await import(
        "@/lib/actions/invoices"
      );
      expect(await markInvoicePaidManually({ id: VALID_INV })).toEqual({
        ok: true,
        data: { id: VALID_INV },
      });
      expect(auditInserts()).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(
        "[invoices] audit log insert failed (non-fatal):",
        undefined,
      );
      expect(revalidatePath).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
