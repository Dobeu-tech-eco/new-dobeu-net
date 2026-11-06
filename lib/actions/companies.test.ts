import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildStubClient } from "./__test-helpers";

// Mutable holder: each test swaps in the cookie user + a per-test admin client.
const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    adminClient: unknown;
    events: string[];
    marked: boolean;
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    adminClient: null,
    events: [],
    marked: true,
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/resend", () => ({
  isResendConfigured: vi.fn(() => true),
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/email-link-signin", () => ({
  hasCurrentEmailLinkSignIn: vi.fn(() => h.state.marked),
}));

vi.mock("@/lib/supabase/server", () => ({
  // Cookie-bound client: only needs auth.getUser for the requireAdmin gate.
  createClient: vi.fn(async () => ({
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: { currentLevel: "aal2", nextLevel: "aal2" },
          error: null,
        })),
      },
      getUser: vi.fn(async () => ({
        data: { user: h.state.user },
        error: null,
      })),
    },
  })),
  // Service-role client: the per-test stub with tables + auth.admin.
  createAdminClient: vi.fn(() => h.state.adminClient),
}));


/**
 * Build a service-role stub: buildStubClient for the table surface, plus the
 * auth.admin methods buildStubClient does not provide (per task guidance —
 * extend locally, never edit __test-helpers.ts).
 */
function buildAdmin(opts: {
  tables?: Parameters<typeof buildStubClient>[0]["tables"];
  create?: {
    data: { user: { id: string } | null };
    error: { message?: string; code?: string; status?: number } | null;
  };
  /** Result of the find_auth_user_id_by_email rpc (null = no match). */
  rpcId?: string | null;
}) {
  const base = buildStubClient({
    user: h.state.user,
    tables: opts.tables ?? {},
  });
  const createResult = opts.create ?? {
    data: { user: { id: "new_user" } },
    error: null,
  };
  const client = {
    ...base.supabase,
    rpc: vi.fn(async () => ({ data: opts.rpcId ?? null, error: null })),
    auth: {
      ...base.supabase.auth,
      admin: {
        createUser: vi.fn(async () => createResult),
        getUserById: vi.fn(async (id: string) => ({
          data: { user: { id, email: "known@example.com" } },
          error: null,
        })),
        deleteUser: vi.fn(async () => ({ error: null })),
        listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
      },
    },
  };
  return { client, recorded: base.recorded };
}

function auditWritten(recorded: { table: string; method: string }[]): boolean {
  return recorded.some(
    (r) => r.table === "admin_audit_log" && r.method === "insert",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.events = [];
  h.state.marked = true;
  sendEmailMock.mockResolvedValue({ ok: true });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://admin-test.example");
  h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  h.state.adminClient = null;
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

afterEach(() => vi.unstubAllEnvs());

const COMPANY_ID = "c0000000-0000-0000-0000-000000000001";
const MEMBER_ROW_ID = "m0000000-0000-0000-0000-000000000001";

describe("createCompany", () => {
  it("logs only the audit error code while preserving primary success", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const auditError = { message: "private database details", code: "42501" };
    const admin = buildAdmin({
      tables: {
        companies: { insert: { data: { id: "comp_1" } } },
        admin_audit_log: { insert: { error: auditError } },
      },
    });
    h.state.adminClient = admin.client;
    try {
      const { createCompany } = await import("@/lib/actions/companies");
      expect(await createCompany({ name: "Acme" })).toEqual({
        ok: true,
        data: { id: "comp_1" },
      });
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        "[companies] audit log insert failed (non-fatal):",
        "42501",
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("inserts, audits, and returns the id when admin", async () => {
    const admin = buildAdmin({
      tables: {
        companies: { insert: { data: { id: "comp_1" } } },
        admin_audit_log: { insert: { data: { id: "log_1" } } },
      },
    });
    h.state.adminClient = admin.client;

    const { createCompany } = await import("@/lib/actions/companies");
    const result = await createCompany({ name: "Acme Corp" });

    expect(result).toEqual({ ok: true, data: { id: "comp_1" } });
    expect(auditWritten(admin.recorded)).toBe(true);
  });

  it("blocks non-admin callers", async () => {
    h.state.user = { id: "u", email: "stranger@example.com" };
    h.state.adminClient = buildAdmin({}).client;
    const { createCompany } = await import("@/lib/actions/companies");
    const result = await createCompany({ name: "Sneaky Inc" });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("blocks unauthenticated callers", async () => {
    h.state.user = null;
    h.state.adminClient = buildAdmin({}).client;
    const { createCompany } = await import("@/lib/actions/companies");
    const result = await createCompany({ name: "Anon Inc" });
    expect(result).toEqual({ ok: false, error: "not_authenticated" });
  });

  it("rejects too-short names", async () => {
    h.state.adminClient = buildAdmin({}).client;
    const { createCompany } = await import("@/lib/actions/companies");
    const result = await createCompany({ name: "x" });
    expect(result.ok).toBe(false);
  });

  it("surfaces a Supabase insert error", async () => {
    h.state.adminClient = buildAdmin({
      tables: {
        companies: {
          insert: { data: null, error: { message: "unique violation" } },
        },
      },
    }).client;
    const { createCompany } = await import("@/lib/actions/companies");
    const result = await createCompany({ name: "Dup Corp" });
    expect(result).toEqual({ ok: false, error: "unique violation" });
  });
});

describe("suspendCompany / reactivateCompany", () => {
  it("suspends, audits, and returns the id when admin", async () => {
    const admin = buildAdmin({
      tables: { companies: { update: { error: null } } },
    });
    h.state.adminClient = admin.client;
    const { suspendCompany } = await import("@/lib/actions/companies");
    const result = await suspendCompany({ id: COMPANY_ID });
    expect(result).toEqual({ ok: true, data: { id: COMPANY_ID } });
    expect(auditWritten(admin.recorded)).toBe(true);
  });

  it("reactivates when admin", async () => {
    h.state.adminClient = buildAdmin({
      tables: { companies: { update: { error: null } } },
    }).client;
    const { reactivateCompany } = await import("@/lib/actions/companies");
    const result = await reactivateCompany({ id: COMPANY_ID });
    expect(result).toEqual({ ok: true, data: { id: COMPANY_ID } });
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "x@x.com" };
    h.state.adminClient = buildAdmin({}).client;
    const { suspendCompany } = await import("@/lib/actions/companies");
    const result = await suspendCompany({ id: COMPANY_ID });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects invalid id", async () => {
    h.state.adminClient = buildAdmin({}).client;
    const { suspendCompany } = await import("@/lib/actions/companies");
    const result = await suspendCompany({ id: "not-a-uuid" });
    expect(result.ok).toBe(false);
  });

  it("propagates Supabase update errors", async () => {
    h.state.adminClient = buildAdmin({
      tables: {
        companies: { update: { error: { message: "rls violation" } } },
      },
    }).client;
    const { reactivateCompany } = await import("@/lib/actions/companies");
    const result = await reactivateCompany({ id: COMPANY_ID });
    expect(result).toEqual({ ok: false, error: "rls violation" });
  });
});

describe("provisionCompanyAdmin", () => {
  const baseTables = (
    member: Record<string, unknown> = {
      selectSingle: { data: null, error: { message: "0 rows" } },
      insert: { data: { id: MEMBER_ROW_ID } },
    },
  ) => ({
    companies: { selectSingle: { data: { id: COMPANY_ID } } },
    company_members: member,
    admin_audit_log: { insert: { data: { id: "log_1" } } },
  });
  const run = async (email = "new@example.com") => {
    const { provisionCompanyAdmin } = await import("@/lib/actions/companies");
    return provisionCompanyAdmin({ companyId: COMPANY_ID, email });
  };
  const insertIndex = (events: string[]) => events.indexOf("insert");

  it("creates a confirmed user, inserts 'invited' first, then sends the email", async () => {
    const admin = buildAdmin({ tables: baseTables() });
    h.state.adminClient = admin.client;
    sendEmailMock.mockImplementation(async () => {
      h.state.events.push("send");
      return { ok: true };
    });
    const originalFrom = admin.client.from;
    admin.client.from = ((t: string) => {
      const chain = originalFrom(t);
      if (t === "company_members") {
        const orig = chain.insert;
        chain.insert = ((...a: unknown[]) => {
          h.state.events.push("insert");
          return orig(...a);
        }) as typeof chain.insert;
      }
      return chain;
    }) as typeof admin.client.from;

    const result = await run();

    expect(result).toEqual({
      ok: true,
      data: { userId: "new_user", status: "invited", emailSent: true },
    });
    expect(admin.client.auth.admin.createUser).toHaveBeenCalledWith({
      email: "new@example.com",
      email_confirm: true,
    });
    expect(h.state.events).toEqual(["insert", "send"]);
    expect(insertIndex(h.state.events)).toBeLessThan(
      h.state.events.indexOf("send"),
    );
    expect(auditWritten(admin.recorded)).toBe(true);
    expect(admin.client.auth.admin.listUsers).not.toHaveBeenCalled();
  });

  it("attaches an existing marked account as an 'invited' membership (rpc lookup)", async () => {
    const admin = buildAdmin({
      tables: baseTables(),
      create: {
        data: { user: null },
        error: { message: "already been registered", code: "email_exists" },
      },
      rpcId: "existing_user",
    });
    h.state.adminClient = admin.client;
    h.state.marked = true;

    const result = await run("known@example.com");

    expect(result).toEqual({
      ok: true,
      data: { userId: "existing_user", status: "invited", emailSent: true },
    });
    expect(admin.client.rpc).toHaveBeenCalledWith(
      "find_auth_user_id_by_email",
      { p_email: "known@example.com" },
    );
    expect(admin.client.auth.admin.listUsers).not.toHaveBeenCalled();
    expect(admin.client.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("refuses an existing account without a current link sign-in: no insert, no email", async () => {
    const admin = buildAdmin({
      tables: baseTables(),
      create: {
        data: { user: null },
        error: { message: "already registered", code: "email_exists" },
      },
      rpcId: "existing_user",
    });
    h.state.adminClient = admin.client;
    h.state.marked = false;

    const result = await run("known@example.com");

    expect(result).toEqual({ ok: false, error: "invitee_needs_link_signin" });
    expect(admin.recorded.some((r) => r.method === "insert")).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(admin.client.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("fails closed when the already-registered user cannot be resolved", async () => {
    h.state.adminClient = buildAdmin({
      tables: baseTables(),
      create: {
        data: { user: null },
        error: { message: "already registered", code: "email_exists" },
      },
      rpcId: null,
    }).client;
    expect(await run()).toEqual({ ok: false, error: "invite failed" });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("promotes an existing membership row, keeping an active row active", async () => {
    const admin = buildAdmin({
      tables: baseTables({
        selectSingle: { data: { id: MEMBER_ROW_ID, status: "active" } },
        update: { error: null },
      }),
      create: {
        data: { user: null },
        error: { message: "already registered", code: "email_exists" },
      },
      rpcId: "existing_user",
    });
    h.state.adminClient = admin.client;
    h.state.marked = true;

    const result = await run("known@example.com");

    expect(result).toEqual({
      ok: true,
      data: { userId: "existing_user", status: "active", emailSent: false },
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("promotes a non-active existing row back to 'invited'", async () => {
    h.state.adminClient = buildAdmin({
      tables: baseTables({
        selectSingle: { data: { id: MEMBER_ROW_ID, status: "disabled" } },
        update: { error: null },
      }),
    }).client;
    expect(await run()).toEqual({
      ok: true,
      data: { userId: "new_user", status: "invited", emailSent: true },
    });
  });

  it("23505 on insert: already_member, never deletes the user", async () => {
    const admin = buildAdmin({
      tables: baseTables({
        selectSingle: { data: null, error: { message: "0 rows" } },
        insert: {
          data: null,
          error: { message: "dup", code: "23505" } as { message: string },
        },
      }),
    });
    h.state.adminClient = admin.client;

    expect(await run()).toEqual({ ok: false, error: "already_member" });
    expect(admin.client.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("other insert failure: deletes only a user it created with no memberships, no email", async () => {
    const admin = buildAdmin({
      tables: baseTables({
        selectSingle: { data: null, error: { message: "0 rows" } },
        insert: {
          data: null,
          error: { message: "boom", code: "XX000" } as { message: string },
        },
      }),
    });
    h.state.adminClient = admin.client;
    // The head-count membership check sees no memberships for the new user.
    const baseFrom = admin.client.from;
    admin.client.from = ((t: string) => {
      const chain = baseFrom(t);
      if (t === "company_members") {
        const origSelect = chain.select;
        chain.select = ((cols: string, o?: { head?: boolean }) =>
          o?.head
            ? { eq: () => Promise.resolve({ count: 0, error: null }) }
            : origSelect(cols)) as typeof chain.select;
      }
      return chain;
    }) as typeof admin.client.from;

    expect(await run()).toEqual({ ok: false, error: "invite failed" });
    expect(admin.client.auth.admin.deleteUser).toHaveBeenCalledWith(
      "new_user",
    );
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("keeps the membership and reports emailSent false when the send fails", async () => {
    h.state.adminClient = buildAdmin({ tables: baseTables() }).client;
    sendEmailMock.mockResolvedValue({ ok: false, error: new Error("x") });
    expect(await run()).toEqual({
      ok: true,
      data: { userId: "new_user", status: "invited", emailSent: false },
    });
  });

  it("errors when the company does not exist", async () => {
    h.state.adminClient = buildAdmin({
      tables: {
        companies: {
          selectSingle: { data: null, error: { message: "0 rows" } },
        },
      },
    }).client;
    expect(await run()).toEqual({ ok: false, error: "company not found" });
  });

  it("returns a fixed error when createUser fails for another reason", async () => {
    h.state.adminClient = buildAdmin({
      tables: baseTables(),
      create: { data: { user: null }, error: { message: "smtp unavailable" } },
    }).client;
    expect(await run()).toEqual({ ok: false, error: "invite failed" });
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "x@x.com" };
    h.state.adminClient = buildAdmin({}).client;
    expect(await run()).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects an invalid email", async () => {
    h.state.adminClient = buildAdmin({}).client;
    expect((await run("not-an-email")).ok).toBe(false);
  });
});
