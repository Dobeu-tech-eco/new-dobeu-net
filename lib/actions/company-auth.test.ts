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

function clientWith(opts: {
  member?: { role: string; status: string } | null;
  memberError?: { message: string } | null;
  rank?: number | null;
}) {
  return buildStubClient({
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
      }
    }
  }).supabase;
}

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

describe("requireCompanyAdmin", () => {
  it("passes for a company_admin (rank 100)", async () => {
    h.state.client = clientWith({
      member: { role: "company_admin", status: "active" },
      rank: COMPANY_ADMIN_RANK
    });

    const { membership } = await requireCompanyAdmin(COMPANY_ID);
    expect(membership.role).toBe("company_admin");
    expect(membership.rank).toBe(COMPANY_ADMIN_RANK);
  });

  it("rejects a manager (rank 60)", async () => {
    h.state.client = clientWith({
      member: { role: "manager", status: "active" },
      rank: 60
    });

    await expect(requireCompanyAdmin(COMPANY_ID)).rejects.toMatchObject({
      code: "forbidden"
    });
  });
});
