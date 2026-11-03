import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildStubClient } from "./__test-helpers";

const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    inviteResult: {
      data: { user: { id: string } | null };
      error: { message: string } | null;
    };
    updateError: { message: string } | null;
    recorded: { table: string; method: string; args: unknown[] }[];
    capturedInvite: { email: string; options?: unknown } | null;
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    inviteResult: { data: { user: { id: "new_user_1" } }, error: null },
    updateError: null,
    recorded: [],
    capturedInvite: null,
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils")>()),
  buildServerAuthCallbackUrl: vi.fn(
    (next: string) =>
      `https://admin-test.example/auth/callback?next=${encodeURIComponent(next)}`,
  ),
}));
import { buildServerAuthCallbackUrl } from "@/lib/utils";

vi.mock("@/lib/supabase/server", () => {
  function buildClient() {
    const base = buildStubClient({
      user: h.state.user,
      tables: { profiles: { update: { error: h.state.updateError } } },
    });
    h.state.recorded = base.recorded;
    return {
      ...base.supabase,
      auth: {
        ...base.supabase.auth,
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({
            data: { currentLevel: "aal2", nextLevel: "aal2" },
            error: null,
          })),
        },
        admin: {
          inviteUserByEmail: vi.fn(async (email: string, options?: unknown) => {
            h.state.capturedInvite = { email, options };
            return h.state.inviteResult;
          }),
        },
      },
    };
  }
  return {
    createClient: vi.fn(async () => buildClient()),
    createAdminClient: vi.fn(() => buildClient()),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://admin-test.example");
  h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  h.state.inviteResult = { data: { user: { id: "new_user_1" } }, error: null };
  h.state.updateError = null;
  h.state.recorded = [];
  h.state.capturedInvite = null;
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

afterEach(() => vi.unstubAllEnvs());

const validId = "00000000-0000-0000-0000-000000000001";

describe("inviteUser", () => {
  it("invites a valid email when admin", async () => {
    const { inviteUser } = await import("@/lib/actions/users");
    const result = await inviteUser({
      email: "client@example.com",
      full_name: "Client Co",
    });
    expect(result).toEqual({
      ok: true,
      data: { id: "new_user_1", email: "client@example.com" },
    });
    expect(buildServerAuthCallbackUrl).toHaveBeenCalledWith("/portal");
    expect(h.state.capturedInvite).toEqual({
      email: "client@example.com",
      options: {
        data: { full_name: "Client Co" },
        redirectTo: "https://admin-test.example/auth/callback?next=%2Fportal",
      },
    });
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
    h.state.inviteResult = {
      data: { user: null },
      error: { message: "smtp not configured" },
    };
    const { inviteUser } = await import("@/lib/actions/users");
    const result = await inviteUser({ email: "client@example.com" });
    expect(result).toEqual({ ok: false, error: "smtp not configured" });
  });
});

describe("updateUser", () => {
  it("updates name + company when admin", async () => {
    const { updateUser } = await import("@/lib/actions/users");
    const result = await updateUser({
      id: validId,
      full_name: "Jane",
      company: "Acme",
    });
    expect(result).toEqual({ ok: true, data: { id: validId } });
    expect(h.state.recorded).toContainEqual({
      table: "profiles",
      method: "update",
      args: [{ full_name: "Jane", company: "Acme" }],
    });
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
