import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildStubClient } from "./__test-helpers";

// Mutable holder: each test swaps in a differently-configured cookie client and
// tunes the service-role auth-admin responses.
const h = vi.hoisted(() => {
  const state: {
    client: unknown;
    inviteResult: { data: { user: { id: string } | null } | null; error: { message: string } | null };
    users: { id: string; email: string }[];
    capturedInvite: string | null;
  } = {
    client: null,
    inviteResult: { data: { user: { id: "new_user_1" } }, error: null },
    users: [],
    capturedInvite: null
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.state.client),
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(async (email: string) => {
          h.state.capturedInvite = email;
          return h.state.inviteResult;
        }),
        listUsers: vi.fn(async () => ({ data: { users: h.state.users }, error: null }))
      }
    }
  }))
}));

import {
  inviteMember,
  changeMemberRole,
  deactivateMember
} from "@/lib/actions/members";

const COMPANY_ID = "c0000000-0000-4000-8000-000000000001";
const MEMBER_ID = "a0000000-0000-4000-8000-000000000009";

// Guard reads company_members {role,status}; deactivate reads {id,user_id}.
// One object serves both. user_id defaults to a non-caller so self-disable
// only triggers when a test overrides it.
const ADMIN_MEMBER = {
  role: "company_admin",
  status: "active",
  id: MEMBER_ID,
  user_id: "other_user"
};

function makeClient(
  opts: {
    user?: { id: string; email: string } | null;
    member?: Record<string, unknown> | null;
    rank?: number;
    roleValid?: boolean;
    insert?: { data?: unknown; error?: { message: string } | null };
    update?: { error?: { message: string } | null };
  } = {}
) {
  const {
    user = { id: "admin_1", email: "admin@dobeu.net" },
    member = ADMIN_MEMBER,
    rank = 100,
    roleValid = true,
    insert = { data: { id: "m_new" } },
    update = { error: null }
  } = opts;
  return buildStubClient({
    user,
    tables: {
      company_members: { selectSingle: { data: member }, insert, update },
      company_roles: { selectSingle: { data: roleValid ? { key: "employee", rank } : null } }
    }
  }).supabase;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.client = makeClient();
  h.state.inviteResult = { data: { user: { id: "new_user_1" } }, error: null };
  h.state.users = [];
  h.state.capturedInvite = null;
});

describe("inviteMember", () => {
  it("invites a new user and inserts an invited member row", async () => {
    h.state.client = makeClient({ user: { id: "inv_new", email: "a@d.net" } });
    const result = await inviteMember(COMPANY_ID, "client@example.com", "employee");
    expect(result).toEqual({
      ok: true,
      data: { id: "m_new", user_id: "new_user_1", email: "client@example.com" }
    });
    expect(h.state.capturedInvite).toBe("client@example.com");
  });

  it("attaches an already-registered user via listUsers lookup", async () => {
    h.state.client = makeClient({ user: { id: "inv_existing", email: "a@d.net" } });
    h.state.inviteResult = { data: { user: null }, error: { message: "already registered" } };
    h.state.users = [{ id: "existing_9", email: "Client@Example.com" }];
    const result = await inviteMember(COMPANY_ID, "client@example.com", "employee");
    expect(result).toEqual({
      ok: true,
      data: { id: "m_new", user_id: "existing_9", email: "client@example.com" }
    });
  });

  it("returns the invite error when the user cannot be resolved", async () => {
    h.state.client = makeClient({ user: { id: "inv_fail", email: "a@d.net" } });
    h.state.inviteResult = { data: { user: null }, error: { message: "smtp down" } };
    h.state.users = [];
    const result = await inviteMember(COMPANY_ID, "client@example.com", "employee");
    expect(result).toEqual({ ok: false, error: "smtp down" });
  });

  it("surfaces a member-insert error (e.g. duplicate membership)", async () => {
    h.state.client = makeClient({
      user: { id: "inv_dup", email: "a@d.net" },
      insert: { error: { message: "duplicate key value" } }
    });
    const result = await inviteMember(COMPANY_ID, "client@example.com", "employee");
    expect(result).toEqual({ ok: false, error: "duplicate key value" });
  });

  it("blocks a non-admin caller (rank below 100)", async () => {
    h.state.client = makeClient({
      user: { id: "inv_mgr", email: "mgr@dobeu.net" },
      member: { role: "manager", status: "active" },
      rank: 60
    });
    const result = await inviteMember(COMPANY_ID, "client@example.com", "employee");
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("blocks an unauthenticated caller", async () => {
    h.state.client = makeClient({ user: null });
    const result = await inviteMember(COMPANY_ID, "client@example.com", "employee");
    expect(result).toEqual({ ok: false, error: "not_authenticated" });
  });

  it("rejects an invalid email", async () => {
    const result = await inviteMember(COMPANY_ID, "not-an-email", "employee");
    expect(result.ok).toBe(false);
  });

  it("rate-limits a single admin after the window max", async () => {
    h.state.client = makeClient({ user: { id: "rl_admin", email: "rl@dobeu.net" } });
    const outcomes: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await inviteMember(COMPANY_ID, `person${i}@example.com`, "employee");
      outcomes.push(r.ok);
    }
    // First 5 succeed; the 6th trips the limiter.
    expect(outcomes.slice(0, 5).every(Boolean)).toBe(true);
    const last = await inviteMember(COMPANY_ID, "one-more@example.com", "employee");
    expect(last).toEqual({ ok: false, error: "rate_limited" });
  });
});

describe("changeMemberRole", () => {
  it("updates a member's role when admin", async () => {
    const result = await changeMemberRole(COMPANY_ID, MEMBER_ID, "manager");
    expect(result).toEqual({ ok: true, data: { id: MEMBER_ID } });
  });

  it("blocks a non-admin caller", async () => {
    h.state.client = makeClient({ member: { role: "manager", status: "active" }, rank: 60 });
    const result = await changeMemberRole(COMPANY_ID, MEMBER_ID, "employee");
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects an invalid member id", async () => {
    const result = await changeMemberRole(COMPANY_ID, "bad", "employee");
    expect(result.ok).toBe(false);
  });

  it("propagates a Supabase update error", async () => {
    h.state.client = makeClient({ update: { error: { message: "rls violation" } } });
    const result = await changeMemberRole(COMPANY_ID, MEMBER_ID, "employee");
    expect(result).toEqual({ ok: false, error: "rls violation" });
  });
});

describe("deactivateMember", () => {
  it("disables another member when admin", async () => {
    const result = await deactivateMember(COMPANY_ID, MEMBER_ID);
    expect(result).toEqual({ ok: true, data: { id: MEMBER_ID } });
  });

  it("forbids disabling yourself", async () => {
    h.state.client = makeClient({
      user: { id: "self_1", email: "self@dobeu.net" },
      member: { role: "company_admin", status: "active", id: MEMBER_ID, user_id: "self_1" }
    });
    const result = await deactivateMember(COMPANY_ID, MEMBER_ID);
    expect(result).toEqual({ ok: false, error: "cannot disable yourself" });
  });

  it("blocks a non-admin caller", async () => {
    h.state.client = makeClient({ member: { role: "employee", status: "active" }, rank: 30 });
    const result = await deactivateMember(COMPANY_ID, MEMBER_ID);
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("propagates a Supabase update error", async () => {
    h.state.client = makeClient({ update: { error: { message: "rls violation" } } });
    const result = await deactivateMember(COMPANY_ID, MEMBER_ID);
    expect(result).toEqual({ ok: false, error: "rls violation" });
  });
});
