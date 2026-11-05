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
const ACCEPTED_WO = {
  id: VALID_WO,
  created_by: VALID_USER,
  status: "accepted",
  project_id: VALID_PROJ,
  quoted_amount_cents: 10000,
  title: "Accepted work",
  invoice_id: null,
};

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
    // Prior invoice.create / invoice.link_failed audit rows for the work
    // order (default none) / the read error of that lookup.
    auditHits?: unknown[];
    auditReadError?: { message: string };
    // Status rows of the invoices those audit rows point at (default: active).
    priorInvoices?: unknown[];
    priorInvoicesError?: { message: string };
    // Local rows matching the Stripe invoice id (reuse lookup; default none).
    reuseRows?: unknown[];
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
            const isPriorLookup = a[0] === "id,status";
            const isReuseLookup = a[0] === "id,hosted_invoice_url,status";
            chain.then = (resolve: (v: unknown) => void) =>
              resolve(
                isReuseLookup
                  ? { data: options.reuseRows ?? [], error: null }
                  : isPriorLookup
                  ? {
                      data: options.priorInvoices ?? [
                        { id: "inv_prior", status: "open" },
                      ],
                      error: options.priorInvoicesError ?? null,
                    }
                  : {
                      data: options.unsentInvoices ?? [],
                      error: options.unsentError ?? null,
                    },
              );
          }
          if (key === "select" && table === "admin_audit_log") {
            chain.then = (resolve: (v: unknown) => void) =>
              resolve({
                data: options.auditHits ?? [],
                error: options.auditReadError ?? null,
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

function invoiceInserts() {
  return admin.recorded.filter(
    (entry) => entry.table === "invoices" && entry.method === "insert",
  );
}

// Asserts a refusal whose message contains every stable fragment, so copy
// tweaks to the remedy wording do not break the tests.
function expectRefusal(result: { ok: boolean; error?: string }, ...parts: string[]) {
  expect(result.ok).toBe(false);
  for (const part of parts) expect(result.error).toContain(part);
}

const CHECK_FAILED = "Unable to check for duplicate invoices";

// Stable fragments of the refusal messages (the full remedy text may change).
const ALREADY_PARTS = ["inv_prior", "already billed", "/admin/invoices"];
const LINK_FAILED_PARTS = [
  "inv_prior",
  "link to the ticket failed",
  "work_orders.invoice_id = inv_prior",
];
const UNKNOWN_INVOICE_PARTS = ["no invoice id", "unknown invoice"];
const UNSENT_PARTS = ["unsent invoice", "last 24 hours", "void"];

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
    expectRefusal(
      await createInvoice({
        user_id: VALID_USER,
        project_id: VALID_PROJ,
        amount_cents: 10000,
        work_order_id: VALID_WO,
      }),
      "inv_old",
      "already billed",
    );
    expect(admin.recorded).toContainEqual({
      table: "invoices",
      method: "eq",
      args: ["id", "inv_old"],
    });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(invoiceInserts()).toEqual([]);
    expectNoAudit();
  });

  it("refuses when the linked invoice is open, naming it, without Stripe, insert, or audit", async () => {
    admin = arrange({
      invoiceStatus: "open",
      workOrder: { ...ACCEPTED_WO, invoice_id: "inv_linked" },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const refused = await createInvoice(woInput);
    expectRefusal(refused, "inv_linked", "already billed");
    // After D35 the 24 h Stripe warning only fits a different case.
    expect(refused.ok === false && refused.error).not.toContain("24 hours");
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(invoiceInserts()).toEqual([]);
    expectNoAudit();
  });

  it("proceeds and back-links with .eq(invoice_id, old) when the linked invoice is void", async () => {
    admin = arrange({
      invoiceStatus: "void",
      workOrder: { ...ACCEPTED_WO, invoice_id: "inv_voided" },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice(woInput);
    expect(result.ok).toBe(true);
    expect(stripeMocks.createHostedInvoice).toHaveBeenCalled();
    expect(admin.recorded).toContainEqual({
      table: "work_orders",
      method: "update",
      args: [{ invoice_id: "inv_1" }],
    });
    expect(admin.recorded).toContainEqual({
      table: "work_orders",
      method: "eq",
      args: ["invoice_id", "inv_voided"],
    });
    expect(admin.recorded).not.toContainEqual({
      table: "work_orders",
      method: "is",
      args: ["invoice_id", null],
    });
    expect(result.ok && "linkFailed" in result.data).toBe(false);
  });

  it("fails closed when the linked invoice's status read errors", async () => {
    admin = arrange({
      invoiceReadError: { message: "db down" },
      workOrder: { ...ACCEPTED_WO, invoice_id: "inv_linked" },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect(await createInvoice(woInput)).toEqual({
      ok: false,
      error: CHECK_FAILED,
    });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(invoiceInserts()).toEqual([]);
    expectNoAudit();
  });

  it("fails closed when the linked invoice row is missing", async () => {
    admin = arrange({
      invoiceStatus: null,
      workOrder: { ...ACCEPTED_WO, invoice_id: "inv_gone" },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect(await createInvoice(woInput)).toEqual({
      ok: false,
      error: CHECK_FAILED,
    });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
  });

  const PRIOR_CREATE = [
    { target_id: "inv_prior", action: "invoice.create" },
  ];
  const PRIOR_FOR_WO = [
    { target_id: "inv_prior", action: "invoice.create_for_work_order" },
  ];
  const woInput = {
    user_id: VALID_USER,
    project_id: VALID_PROJ,
    amount_cents: 10000,
    work_order_id: VALID_WO,
  };

  it("blocks a second invoice when an earlier active invoice exists for the work order", async () => {
    admin = arrange({ auditHits: PRIOR_CREATE });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expectRefusal(await createInvoice(woInput), ...ALREADY_PARTS);
    expect(admin.recorded).toContainEqual({
      table: "admin_audit_log",
      method: "in",
      args: [
        "action",
        ["invoice.create", "invoice.create_for_work_order", "invoice.link_failed"],
      ],
    });
    expect(admin.recorded).toContainEqual({
      table: "admin_audit_log",
      method: "eq",
      args: ["data->>work_order_id", VALID_WO],
    });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(
      admin.recorded.filter((e) => e.table === "invoices" && e.method === "insert"),
    ).toEqual([]);
    expectNoAudit();
  });

  it("uses the link-failed message when the active invoice's link failed", async () => {
    admin = arrange({
      auditHits: [{ target_id: "inv_prior", action: "invoice.link_failed" }],
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expectRefusal(await createInvoice(woInput), ...LINK_FAILED_PARTS);
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("blocks with the unknown-invoice message when an audit row has no target id", async () => {
    admin = arrange({
      auditHits: [{ target_id: null, action: "invoice.create" }],
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expectRefusal(await createInvoice(woInput), ...UNKNOWN_INVOICE_PARTS);
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(invoiceInserts()).toEqual([]);
    expectNoAudit();
  });

  it("blocks with the unknown-invoice message even when other audited invoices are void", async () => {
    admin = arrange({
      auditHits: [
        { target_id: "inv_prior", action: "invoice.create" },
        { target_id: null, action: "invoice.link_failed" },
      ],
      priorInvoices: [{ id: "inv_prior", status: "void" }],
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expectRefusal(await createInvoice(woInput), ...UNKNOWN_INVOICE_PARTS);
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
  });

  it("allows a re-invoice when every earlier invoice is void", async () => {
    admin = arrange({
      auditHits: PRIOR_CREATE,
      priorInvoices: [{ id: "inv_prior", status: "void" }],
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect((await createInvoice(woInput)).ok).toBe(true);
    expect(stripeMocks.createHostedInvoice).toHaveBeenCalled();
  });

  it("allows a re-invoice when the audited invoice no longer exists", async () => {
    admin = arrange({ auditHits: PRIOR_CREATE, priorInvoices: [] });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect((await createInvoice(woInput)).ok).toBe(true);
  });

  it("fails closed when the audit-row lookup errors", async () => {
    admin = arrange({ auditReadError: { message: "db down" } });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect(await createInvoice(woInput)).toEqual({
      ok: false,
      error: "Unable to check for duplicate invoices",
    });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("fails closed when the prior-invoice status read errors", async () => {
    admin = arrange({
      auditHits: PRIOR_CREATE,
      priorInvoicesError: { message: "db down" },
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect(await createInvoice(woInput)).toEqual({
      ok: false,
      error: "Unable to check for duplicate invoices",
    });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
  });

  it("proceeds when no audit row exists for the work order", async () => {
    admin = arrange({ auditHits: [] });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect((await createInvoice(woInput)).ok).toBe(true);
    expect(stripeMocks.createHostedInvoice).toHaveBeenCalled();
  });

  it("createInvoiceForWorkOrder refuses when a createInvoice audit row exists", async () => {
    admin = arrange({ auditHits: PRIOR_CREATE });
    const { createInvoiceForWorkOrder } = await import("@/lib/actions/invoices");
    expectRefusal(
      await createInvoiceForWorkOrder({ work_order_id: VALID_WO }),
      ...ALREADY_PARTS,
    );
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expectNoAudit();
  });

  it("createInvoice refuses when a createInvoiceForWorkOrder audit row exists", async () => {
    admin = arrange({ auditHits: PRIOR_FOR_WO });
    const { createInvoice } = await import("@/lib/actions/invoices");
    expectRefusal(await createInvoice(woInput), ...ALREADY_PARTS);
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
  });

  it("rejects an invalid currency code in Zod", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice({
      user_id: VALID_USER,
      amount_cents: 10000,
      currency: "U$D",
    });
    expect(result.ok).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
  });

  it("normalises a lowercase currency to upper case", async () => {
    const { createInvoice } = await import("@/lib/actions/invoices");
    expect((await createInvoice({ user_id: VALID_USER, amount_cents: 10000, currency: "usd" })).ok).toBe(true);
    expect(stripeMocks.createHostedInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "usd" }),
    );
  });

  it("records reused: true in the invoice.create audit when the Stripe invoice was already recorded", async () => {
    admin = arrange({
      reuseRows: [{ id: "inv_existing", hosted_invoice_url: null, status: "open" }],
    });
    const { createInvoice } = await import("@/lib/actions/invoices");
    const result = await createInvoice(woInput);
    expect(result.ok).toBe(true);
    expect(
      admin.recorded.filter((e) => e.table === "invoices" && e.method === "insert"),
    ).toEqual([]);
    expect(auditInserts()[0].args).toEqual([
      expect.objectContaining({
        action: "invoice.create",
        target_id: "inv_existing",
        data: expect.objectContaining({ work_order_id: VALID_WO, reused: true }),
      }),
    ]);
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
        data: { amount_cents: 10000, stripe_failed: true, work_order_id: null },
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
    expectRefusal(result, ...UNSENT_PARTS);
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
    expect(result.ok && "linkFailed" in result.data).toBe(false);
    expect(auditInserts()).toHaveLength(1);
    expect(auditInserts()[0].args).toEqual([
      expect.objectContaining({
        actor_user_id: ADMIN.id,
        action: "invoice.create_for_work_order",
        target_type: "invoice",
      }),
    ]);
  });

  it.each([
    ["a zero-row update", { linkRows: [] }],
    ["a null update result", { linkRows: null }],
    ["an update error", { linkError: { message: "boom" } }],
  ])(
    "returns linkFailed (invoice kept) and audits invoice.link_failed on %s",
    async (_name, opts) => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      admin = arrange(opts);
      try {
        const { createInvoiceForWorkOrder } = await import("@/lib/actions/invoices");
        const result = await createInvoiceForWorkOrder({ work_order_id: VALID_WO });
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
          method: "is",
          args: ["invoice_id", null],
        });
        expect(auditInserts().map((e) => e.args)).toEqual([
          [
            expect.objectContaining({
              action: "invoice.link_failed",
              target_id: "inv_1",
              data: { work_order_id: VALID_WO },
            }),
          ],
          [
            expect.objectContaining({
              action: "invoice.create_for_work_order",
              data: expect.objectContaining({ work_order_id: VALID_WO }),
            }),
          ],
        ]);
      } finally {
        consoleError.mockRestore();
      }
    },
  );

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
    expectRefusal(
      await createInvoiceForWorkOrder({ work_order_id: VALID_WO }),
      "inv_old",
      "already billed",
    );
    expect(admin.recorded).toContainEqual({
      table: "invoices",
      method: "eq",
      args: ["id", "inv_old"],
    });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(invoiceInserts()).toEqual([]);
    expectNoAudit();
  });

  it("proceeds and back-links with .eq(invoice_id, old) when the linked invoice is void", async () => {
    admin = arrange({
      invoiceStatus: "void",
      workOrder: { ...ACCEPTED_WO, invoice_id: "inv_voided" },
    });
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    const result = await createInvoiceForWorkOrder({ work_order_id: VALID_WO });
    expect(result.ok).toBe(true);
    expect(stripeMocks.createHostedInvoice).toHaveBeenCalled();
    expect(admin.recorded).toContainEqual({
      table: "work_orders",
      method: "update",
      args: [{ invoice_id: "inv_1" }],
    });
    expect(admin.recorded).toContainEqual({
      table: "work_orders",
      method: "eq",
      args: ["invoice_id", "inv_voided"],
    });
    expect(admin.recorded).not.toContainEqual({
      table: "work_orders",
      method: "is",
      args: ["invoice_id", null],
    });
    expect(auditInserts().map((e) => e.args)).toEqual([
      [expect.objectContaining({ action: "invoice.create_for_work_order" })],
    ]);
  });

  it("refuses when the linked invoice is open, naming it, without Stripe, insert, or audit", async () => {
    admin = arrange({
      invoiceStatus: "open",
      workOrder: { ...ACCEPTED_WO, invoice_id: "inv_linked" },
    });
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    expectRefusal(
      await createInvoiceForWorkOrder({ work_order_id: VALID_WO }),
      "inv_linked",
      "already billed",
    );
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(invoiceInserts()).toEqual([]);
    expectNoAudit();
  });

  it("fails closed when the linked invoice's status read errors", async () => {
    admin = arrange({
      invoiceReadError: { message: "db down" },
      workOrder: { ...ACCEPTED_WO, invoice_id: "inv_linked" },
    });
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    expect(
      await createInvoiceForWorkOrder({ work_order_id: VALID_WO }),
    ).toEqual({ ok: false, error: CHECK_FAILED });
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(invoiceInserts()).toEqual([]);
    expectNoAudit();
  });

  it("blocks with the unknown-invoice message when an audit row has no target id", async () => {
    admin = arrange({
      auditHits: [{ target_id: null, action: "invoice.create_for_work_order" }],
    });
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    expectRefusal(
      await createInvoiceForWorkOrder({ work_order_id: VALID_WO }),
      ...UNKNOWN_INVOICE_PARTS,
    );
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
    expect(invoiceInserts()).toEqual([]);
    expectNoAudit();
  });

  it("uses the link-failed message when the active invoice's link failed", async () => {
    admin = arrange({
      auditHits: [{ target_id: "inv_prior", action: "invoice.link_failed" }],
    });
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    expectRefusal(
      await createInvoiceForWorkOrder({ work_order_id: VALID_WO }),
      ...LINK_FAILED_PARTS,
    );
    expectNoAudit();
  });

  it("rejects a recent unsent same-amount invoice without touching Stripe", async () => {
    admin = arrange({ unsentInvoices: [{ id: "inv_unsent" }] });
    const { createInvoiceForWorkOrder } = await import(
      "@/lib/actions/invoices"
    );
    expectRefusal(
      await createInvoiceForWorkOrder({ work_order_id: VALID_WO }),
      "unsent invoice",
      "last 24 hours",
    );
    expect(stripeMocks.createHostedInvoice).not.toHaveBeenCalled();
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
