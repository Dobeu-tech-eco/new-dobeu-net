import { describe, it, expect, beforeEach, vi } from "vitest";

// Shared mutable auth state so each test can set the "current user".
const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    aal: { currentLevel: "aal1" | "aal2"; nextLevel: "aal1" | "aal2" } | null;
  } = {
    user: { id: "user_1", email: "client@example.com" },
    aal: { currentLevel: "aal2", nextLevel: "aal2" },
  };
  return { state };
});

const adminClientSentinel = { __admin: true };

vi.mock("@/lib/supabase/server", () => {
  const cookieBound = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: h.state.user },
        error: null,
      })),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: h.state.aal,
          error: null,
        })),
      },
    },
  };
  return {
    createClient: vi.fn(async () => cookieBound),
    createAdminClient: vi.fn(() => adminClientSentinel),
  };
});

import {
  requireUser,
  requireAdmin,
  requireAdminAal2,
  AuthError,
} from "@/lib/actions/auth";

beforeEach(() => {
  vi.clearAllMocks();
  h.state.user = { id: "user_1", email: "client@example.com" };
  h.state.aal = { currentLevel: "aal2", nextLevel: "aal2" };
  // isAdminEmail() reads ADMIN_EMAILS — set a known admin allowlist.
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

describe("requireUser", () => {
  it("returns the user + cookie-bound client when authenticated", async () => {
    const { user, supabase } = await requireUser();
    expect(user).toEqual({ id: "user_1", email: "client@example.com" });
    expect(supabase).toBeDefined();
  });

  it("throws AuthError('not_authenticated') when there is no user", async () => {
    h.state.user = null;
    await expect(requireUser()).rejects.toMatchObject({
      name: "AuthError",
      code: "not_authenticated",
    });
    await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
  });
});

describe("requireAdmin", () => {
  it("returns user + supabase + admin client for an allow-listed admin", async () => {
    h.state.user = { id: "admin_1", email: "admin@dobeu.net" };
    const { user, supabase, admin } = await requireAdmin();
    expect(user.email).toBe("admin@dobeu.net");
    expect(supabase).toBeDefined();
    expect(admin).toBe(adminClientSentinel);
  });

  it("throws AuthError('forbidden') for an authenticated non-admin", async () => {
    h.state.user = { id: "user_1", email: "client@example.com" };
    await expect(requireAdmin()).rejects.toMatchObject({
      name: "AuthError",
      code: "forbidden",
    });
  });

  it("throws AuthError('not_authenticated') when there is no user", async () => {
    h.state.user = null;
    await expect(requireAdmin()).rejects.toMatchObject({
      name: "AuthError",
      code: "not_authenticated",
    });
  });
});

describe("requireAdminAal2", () => {
  it("returns the service-role client for an AAL2 admin", async () => {
    h.state.user = { id: "admin_1", email: "admin@dobeu.net" };

    const { user, admin } = await requireAdminAal2();

    expect(user.id).toBe("admin_1");
    expect(admin).toBe(adminClientSentinel);
  });

  it("rejects an unenrolled AAL1 admin", async () => {
    h.state.user = { id: "admin_1", email: "admin@dobeu.net" };
    h.state.aal = { currentLevel: "aal1", nextLevel: "aal1" };

    await expect(requireAdminAal2()).rejects.toMatchObject({
      name: "AuthError",
      code: "mfa_required",
    });
  });

  it("rejects an enrolled admin whose session has not stepped up", async () => {
    h.state.user = { id: "admin_1", email: "admin@dobeu.net" };
    h.state.aal = { currentLevel: "aal1", nextLevel: "aal2" };

    await expect(requireAdminAal2()).rejects.toMatchObject({
      name: "AuthError",
      code: "mfa_required",
    });
  });

  it("fails closed when assurance data is unavailable", async () => {
    h.state.user = { id: "admin_1", email: "admin@dobeu.net" };
    h.state.aal = null;

    await expect(requireAdminAal2()).rejects.toMatchObject({
      name: "AuthError",
      code: "mfa_required",
    });
  });
});
