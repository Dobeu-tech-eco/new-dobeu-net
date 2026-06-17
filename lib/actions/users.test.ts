import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    inviteResult: { data: { user: { id: string } | null }; error: { message: string } | null };
    updateError: { message: string } | null;
    capturedPatch: Record<string, unknown> | null;
    capturedInvite: { email: string; options?: unknown } | null;
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    inviteResult: { data: { user: { id: "new_user_1" } }, error: null },
    updateError: null,
    capturedPatch: null,
    capturedInvite: null
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => {
  function buildClient() {
    return {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null })),
        admin: {
          inviteUserByEmail: vi.fn(async (email: string, options?: unknown) => {
            h.state.capturedInvite = { email, options };
            return h.state.inviteResult;
          })
        }
      },
      from: vi.fn(() => ({
        update: vi.fn((patch: Record<string, unknown>) => {
          h.state.capturedPatch = patch;
          return {
            eq: vi.fn(() => Promise.resolve({ data: null, error: h.state.updateError }))
          };
        })
      }))
    };
  }
  return {
    createClient: vi.fn(async () => buildClient()),
    createAdminClient: vi.fn(() => buildClient())
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  h.state.inviteResult = { data: { user: { id: "new_user_1" } }, error: null };
  h.state.updateError = null;
  h.state.capturedPatch = null;
  h.state.capturedInvite = null;
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

const validId = "00000000-0000-0000-0000-000000000001";

describe("inviteUser", () => {
  it("invites a valid email when admin", async () => {
    const { inviteUser } = await import("@/lib/actions/users");
    const result = await inviteUser({ email: "client@example.com", full_name: "Client Co" });
    expect(result).toEqual({ ok: true, data: { id: "new_user_1", email: "client@example.com" } });
    expect(h.state.capturedInvite?.email).toBe("client@example.com");
  });

  it("blocks non-admin callers", async () => {
    h.state.user = { id: "u", email: "stranger@example.com" };
    const { inviteUser } = await import("@/lib/actions/users");
    const result = await inviteUser({ email: "client@example.com" });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("blocks unauthenticated callers", async () => {
    h.state.user = null;
    const { inviteUser } = await import("@/lib/actions/users");
    const result = await inviteUser({ email: "client@example.com" });
    expect(result).toEqual({ ok: false, error: "not_authenticated" });
  });

  it("rejects an invalid email", async () => {
    const { inviteUser } = await import("@/lib/actions/users");
    const result = await inviteUser({ email: "not-an-email" });
    expect(result.ok).toBe(false);
  });

  it("surfaces a Supabase invite error", async () => {
    h.state.inviteResult = { data: { user: null }, error: { message: "smtp not configured" } };
    const { inviteUser } = await import("@/lib/actions/users");
    const result = await inviteUser({ email: "client@example.com" });
    expect(result).toEqual({ ok: false, error: "smtp not configured" });
  });
});

describe("updateUser", () => {
  it("updates name + company when admin", async () => {
    const { updateUser } = await import("@/lib/actions/users");
    const result = await updateUser({ id: validId, full_name: "Jane", company: "Acme" });
    expect(result).toEqual({ ok: true, data: { id: validId } });
    expect(h.state.capturedPatch).toEqual({ full_name: "Jane", company: "Acme" });
  });

  it("rejects no-op (no patch fields)", async () => {
    const { updateUser } = await import("@/lib/actions/users");
    const result = await updateUser({ id: validId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no fields/);
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "x@x.com" };
    const { updateUser } = await import("@/lib/actions/users");
    const result = await updateUser({ id: validId, full_name: "Jane" });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects invalid id", async () => {
    const { updateUser } = await import("@/lib/actions/users");
    const result = await updateUser({ id: "bad", full_name: "Jane" });
    expect(result.ok).toBe(false);
  });

  it("propagates Supabase update errors", async () => {
    h.state.updateError = { message: "rls violation" };
    const { updateUser } = await import("@/lib/actions/users");
    const result = await updateUser({ id: validId, full_name: "Jane" });
    expect(result).toEqual({ ok: false, error: "rls violation" });
  });
});
