import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildStubClient } from "./__test-helpers";

// Mutable holder: each test swaps in the cookie user + a per-test admin client.
const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    adminClient: unknown;
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    adminClient: null
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  // Cookie-bound client: only needs auth.getUser for the requireAdmin gate.
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null }))
    }
  })),
  // Service-role client: the per-test stub with tables + auth.admin.
  createAdminClient: vi.fn(() => h.state.adminClient)
}));

type AuthUser = { id: string; email: string };

/**
 * Build a service-role stub: buildStubClient for the table surface, plus the
 * auth.admin methods buildStubClient does not provide (per task guidance —
 * extend locally, never edit __test-helpers.ts).
 */
function buildAdmin(opts: {
  tables?: Parameters<typeof buildStubClient>[0]["tables"];
  invite?: { data: { user: { id: string } | null }; error: { message?: string; code?: string; status?: number } | null };
  listUsers?: { data: { users: AuthUser[] }; error: { message: string } | null };
}) {
  const base = buildStubClient({ user: h.state.user, tables: opts.tables ?? {} });
  const inviteResult = opts.invite ?? { data: { user: { id: "new_user" } }, error: null };
  const listUsersResult = opts.listUsers ?? { data: { users: [] as AuthUser[] }, error: null };
  const client = {
    ...base.supabase,
    auth: {
      ...base.supabase.auth,
      admin: {
        inviteUserByEmail: vi.fn(async () => inviteResult),
        listUsers: vi.fn(async () => listUsersResult)
      }
    }
  };
  return { client, recorded: base.recorded };
}

function auditWritten(recorded: { table: string; method: string }[]): boolean {
  return recorded.some((r) => r.table === "admin_audit_log" && r.method === "insert");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  h.state.adminClient = null;
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

const COMPANY_ID = "c0000000-0000-0000-0000-000000000001";
const MEMBER_ROW_ID = "m0000000-0000-0000-0000-000000000001";

describe("createCompany", () => {
  it("inserts, audits, and returns the id when admin", async () => {
    const admin = buildAdmin({
      tables: {
        companies: { insert: { data: { id: "comp_1" } } },
        admin_audit_log: { insert: { data: { id: "log_1" } } }
      }
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
      tables: { companies: { insert: { data: null, error: { message: "unique violation" } } } }
    }).client;
    const { createCompany } = await import("@/lib/actions/companies");
    const result = await createCompany({ name: "Dup Corp" });
    expect(result).toEqual({ ok: false, error: "unique violation" });
  });
});

describe("suspendCompany / reactivateCompany", () => {
  it("suspends, audits, and returns the id when admin", async () => {
    const admin = buildAdmin({ tables: { companies: { update: { error: null } } } });
    h.state.adminClient = admin.client;
    const { suspendCompany } = await import("@/lib/actions/companies");
    const result = await suspendCompany({ id: COMPANY_ID });
    expect(result).toEqual({ ok: true, data: { id: COMPANY_ID } });
    expect(auditWritten(admin.recorded)).toBe(true);
  });

  it("reactivates when admin", async () => {
    h.state.adminClient = buildAdmin({ tables: { companies: { update: { error: null } } } }).client;
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
      tables: { companies: { update: { error: { message: "rls violation" } } } }
    }).client;
    const { reactivateCompany } = await import("@/lib/actions/companies");
    const result = await reactivateCompany({ id: COMPANY_ID });
    expect(result).toEqual({ ok: false, error: "rls violation" });
  });
});

describe("provisionCompanyAdmin", () => {
  it("invites a new user and inserts an 'invited' membership", async () => {
    const admin = buildAdmin({
      tables: {
        companies: { selectSingle: { data: { id: COMPANY_ID } } },
        company_members: {
          selectSingle: { data: null, error: { message: "0 rows" } },
          insert: { data: { id: MEMBER_ROW_ID } }
        },
        admin_audit_log: { insert: { data: { id: "log_1" } } }
      },
      invite: { data: { user: { id: "new_user" } }, error: null }
    });
    h.state.adminClient = admin.client;

    const { provisionCompanyAdmin } = await import("@/lib/actions/companies");
    const result = await provisionCompanyAdmin({ companyId: COMPANY_ID, email: "new@example.com" });

    expect(result).toEqual({ ok: true, data: { userId: "new_user", status: "invited" } });
    expect(auditWritten(admin.recorded)).toBe(true);
  });

  it("links an already-registered user as an 'active' membership", async () => {
    const admin = buildAdmin({
      tables: {
        companies: { selectSingle: { data: { id: COMPANY_ID } } },
        company_members: {
          selectSingle: { data: null, error: { message: "0 rows" } },
          insert: { data: { id: MEMBER_ROW_ID } }
        },
        admin_audit_log: { insert: { data: { id: "log_1" } } }
      },
      invite: {
        data: { user: null },
        error: { message: "A user with this email address has already been registered", status: 422 }
      },
      listUsers: {
        data: { users: [{ id: "existing_user", email: "known@example.com" }] },
        error: null
      }
    });
    h.state.adminClient = admin.client;

    const { provisionCompanyAdmin } = await import("@/lib/actions/companies");
    const result = await provisionCompanyAdmin({ companyId: COMPANY_ID, email: "known@example.com" });

    expect(result).toEqual({ ok: true, data: { userId: "existing_user", status: "active" } });
  });

  it("promotes an existing membership row", async () => {
    const admin = buildAdmin({
      tables: {
        companies: { selectSingle: { data: { id: COMPANY_ID } } },
        company_members: {
          selectSingle: { data: { id: MEMBER_ROW_ID } },
          update: { error: null }
        },
        admin_audit_log: { insert: { data: { id: "log_1" } } }
      },
      invite: { data: { user: { id: "new_user" } }, error: null }
    });
    h.state.adminClient = admin.client;

    const { provisionCompanyAdmin } = await import("@/lib/actions/companies");
    const result = await provisionCompanyAdmin({ companyId: COMPANY_ID, email: "new@example.com" });

    expect(result).toEqual({ ok: true, data: { userId: "new_user", status: "invited" } });
  });

  it("errors when the company does not exist", async () => {
    h.state.adminClient = buildAdmin({
      tables: { companies: { selectSingle: { data: null, error: { message: "0 rows" } } } }
    }).client;
    const { provisionCompanyAdmin } = await import("@/lib/actions/companies");
    const result = await provisionCompanyAdmin({ companyId: COMPANY_ID, email: "new@example.com" });
    expect(result).toEqual({ ok: false, error: "company not found" });
  });

  it("surfaces a non-registration invite failure", async () => {
    h.state.adminClient = buildAdmin({
      tables: { companies: { selectSingle: { data: { id: COMPANY_ID } } } },
      invite: { data: { user: null }, error: { message: "smtp unavailable" } }
    }).client;
    const { provisionCompanyAdmin } = await import("@/lib/actions/companies");
    const result = await provisionCompanyAdmin({ companyId: COMPANY_ID, email: "new@example.com" });
    expect(result).toEqual({ ok: false, error: "smtp unavailable" });
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "x@x.com" };
    h.state.adminClient = buildAdmin({}).client;
    const { provisionCompanyAdmin } = await import("@/lib/actions/companies");
    const result = await provisionCompanyAdmin({ companyId: COMPANY_ID, email: "new@example.com" });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects an invalid email", async () => {
    h.state.adminClient = buildAdmin({}).client;
    const { provisionCompanyAdmin } = await import("@/lib/actions/companies");
    const result = await provisionCompanyAdmin({ companyId: COMPANY_ID, email: "not-an-email" });
    expect(result.ok).toBe(false);
  });
});
