import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildStubClient } from "./__test-helpers";

// Mutable holder so each test swaps in a differently-configured stub client.
const h = vi.hoisted(() => {
  const state: { client: unknown } = { client: null };
  return { state };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.state.client),
  createAdminClient: vi.fn(() => ({ __admin: true }))
}));

import {
  requireCompanyMember,
  requireCompanyAdmin,
  COMPANY_ADMIN_RANK
} from "@/lib/actions/company-auth";

const COMPANY_ID = "c0000000-0000-0000-0000-000000000001";
const USER = { id: "user_1", email: "member@example.com" };

type Aal = { currentLevel: string | null; nextLevel: string | null };
const AAL2: Aal = { currentLevel: "aal2", nextLevel: "aal2" };

function clientWith(opts: {
  member?: { role: string; status: string } | null;
  memberError?: { message: string } | null;
  rank?: number | null;
  company?: { status: string } | null;
  companyError?: { message: string } | null;
  aal?: () => Promise<{ data: Aal | null; error: { message: string } | null }>;
}) {
  const stub = buildStubClient({
    user: USER,
    tables: {
      company_members: {
        selectSingle: {
          data: opts.member ?? null,
          error: opts.memberError ?? (opts.member ? null : { message: "0 rows" })
        }
      },
      company_roles: {
        selectSingle: {
          data: opts.rank === null || opts.rank === undefined ? null : { rank: opts.rank }
        }
      },
      companies: {
        selectSingle: {
          data: opts.company ?? null,
          error: opts.companyError ?? (opts.company ? null : { message: "0 rows" })
        }
      }
    }
  });
  return Object.assign(stub.supabase, {
    auth: {
      ...stub.supabase.auth,
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(
          opts.aal ?? (async () => ({ data: AAL2, error: null }))
        )
      }
    }
  });
}

type Stub = ReturnType<typeof clientWith>;
const aalCalls = (c: Stub) => c.auth.mfa.getAuthenticatorAssuranceLevel;
const tablesRead = (c: Stub) => c.from.mock.calls.map(([t]) => t);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireCompanyMember", () => {
  it("returns membership with rank for an active member", async () => {
    h.state.client = clientWith({
      member: { role: "employee", status: "active" },
      rank: 30
    });

    const { user, membership } = await requireCompanyMember(COMPANY_ID);

    expect(user.id).toBe("user_1");
    expect(membership).toEqual({
      companyId: COMPANY_ID,
      role: "employee",
      rank: 30
    });
  });

  it("throws forbidden for a non-member", async () => {
    h.state.client = clientWith({ member: null });

    await expect(requireCompanyMember(COMPANY_ID)).rejects.toMatchObject({
      name: "AuthError",
      code: "forbidden"
    });
  });

  it("throws forbidden when rank is below minRank", async () => {
    h.state.client = clientWith({
      member: { role: "viewer", status: "active" },
      rank: 10
    });

    await expect(requireCompanyMember(COMPANY_ID, 60)).rejects.toMatchObject({
      code: "forbidden"
    });
  });

  it("treats an unknown role key as rank 0", async () => {
    h.state.client = clientWith({
      member: { role: "ghost_role", status: "active" },
      rank: null
    });

    await expect(requireCompanyMember(COMPANY_ID, 1)).rejects.toMatchObject({
      code: "forbidden"
    });
  });

  it("throws not_authenticated when there is no user", async () => {
    h.state.client = buildStubClient({ user: null }).supabase;

    await expect(requireCompanyMember(COMPANY_ID)).rejects.toMatchObject({
      code: "not_authenticated"
    });
  });
});

const ADMIN = { role: "company_admin", status: "active" };
const ACTIVE = { status: "active" };
const aalResult = (data: Aal | null, error: { message: string } | null = null) =>
  async () => ({ data, error });

describe("requireCompanyAdmin", () => {
  it("passes for an AAL2 company_admin of an active company", async () => {
    h.state.client = clientWith({
      member: ADMIN,
      rank: COMPANY_ADMIN_RANK,
      company: ACTIVE
    });

    const { membership } = await requireCompanyAdmin(COMPANY_ID);
    expect(membership.role).toBe("company_admin");
    expect(membership.rank).toBe(COMPANY_ADMIN_RANK);
  });

  it("rejects a manager (rank 60) as forbidden without touching companies or AAL", async () => {
    const client = clientWith({
      member: { role: "manager", status: "active" },
      rank: 60,
      company: ACTIVE
    });
    h.state.client = client;

    await expect(requireCompanyAdmin(COMPANY_ID)).rejects.toMatchObject({
      code: "forbidden"
    });
    expect(aalCalls(client)).not.toHaveBeenCalled();
    expect(tablesRead(client)).not.toContain("companies");
  });

  it.each([
    ["AAL1 with a factor enrolled", aalResult({ currentLevel: "aal1", nextLevel: "aal2" })],
    ["no factor enrolled", aalResult({ currentLevel: "aal1", nextLevel: "aal1" })],
    ["AAL lookup error", aalResult(null, { message: "boom" })],
    [
      "AAL lookup throwing",
      async () => {
        throw new Error("network");
      }
    ]
  ])("throws mfa_required on %s", async (_label, aal) => {
    h.state.client = clientWith({
      member: ADMIN,
      rank: COMPANY_ADMIN_RANK,
      company: ACTIVE,
      aal
    });

    await expect(requireCompanyAdmin(COMPANY_ID)).rejects.toMatchObject({
      code: "mfa_required"
    });
  });

  it("throws forbidden for a suspended company", async () => {
    h.state.client = clientWith({
      member: ADMIN,
      rank: COMPANY_ADMIN_RANK,
      company: { status: "suspended" }
    });

    await expect(requireCompanyAdmin(COMPANY_ID)).rejects.toMatchObject({
      code: "forbidden"
    });
  });

  it("checks status before AAL: an AAL1 admin of a suspended company gets forbidden", async () => {
    const client = clientWith({
      member: ADMIN,
      rank: COMPANY_ADMIN_RANK,
      company: { status: "suspended" },
      aal: aalResult({ currentLevel: "aal1", nextLevel: "aal2" })
    });
    h.state.client = client;

    await expect(requireCompanyAdmin(COMPANY_ID)).rejects.toMatchObject({
      code: "forbidden"
    });
    expect(aalCalls(client)).not.toHaveBeenCalled();
  });

  it("throws forbidden when the companies read throws", async () => {
    const client = clientWith({ member: ADMIN, rank: COMPANY_ADMIN_RANK, company: ACTIVE });
    const realFrom = client.from.getMockImplementation() ?? client.from;
    client.from.mockImplementation((table: string) => {
      if (table === "companies") throw new Error("network");
      return realFrom(table);
    });
    h.state.client = client;

    await expect(requireCompanyAdmin(COMPANY_ID)).rejects.toMatchObject({
      code: "forbidden"
    });
  });

  it("throws forbidden when the companies read errors", async () => {
    h.state.client = clientWith({
      member: ADMIN,
      rank: COMPANY_ADMIN_RANK,
      companyError: { message: "rls" }
    });

    await expect(requireCompanyAdmin(COMPANY_ID)).rejects.toMatchObject({
      code: "forbidden"
    });
  });

  it("throws forbidden when the company row is missing", async () => {
    h.state.client = clientWith({
      member: ADMIN,
      rank: COMPANY_ADMIN_RANK,
      company: null
    });

    await expect(requireCompanyAdmin(COMPANY_ID)).rejects.toMatchObject({
      code: "forbidden"
    });
  });
});

describe("requireCompanyMember (regular member path)", () => {
  it("passes without an AAL lookup or companies read", async () => {
    const client = clientWith({
      member: { role: "employee", status: "active" },
      rank: 30
    });
    h.state.client = client;

    await expect(requireCompanyMember(COMPANY_ID)).resolves.toMatchObject({
      membership: { role: "employee", rank: 30 }
    });
    expect(aalCalls(client)).not.toHaveBeenCalled();
    expect(tablesRead(client)).not.toContain("companies");
  });
});
