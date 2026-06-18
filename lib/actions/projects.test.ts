import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    insertResult: { data: { id: string } | null; error: { message: string } | null };
    updateError: { message: string } | null;
    deleteError: { message: string } | null;
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    insertResult: { data: { id: "proj_1" }, error: null },
    updateError: null,
    deleteError: null
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => {
  function buildClient() {
    return {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null }))
      },
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(h.state.insertResult))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() =>
            Promise.resolve({ data: null, error: h.state.updateError })
          )
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() =>
            Promise.resolve({ data: null, error: h.state.deleteError })
          )
        }))
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
  h.state.insertResult = { data: { id: "proj_1" }, error: null };
  h.state.updateError = null;
  h.state.deleteError = null;
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

const validId = "00000000-0000-0000-0000-000000000001";
const validOwnerId = "00000000-0000-0000-0000-000000000002";

describe("createProject", () => {
  it("inserts and returns id when admin", async () => {
    const { createProject } = await import("@/lib/actions/projects");
    const result = await createProject({
      owner_user_id: validOwnerId,
      title: "New website redesign"
    });
    expect(result).toEqual({ ok: true, data: { id: "proj_1" } });
  });

  it("blocks non-admin callers", async () => {
    h.state.user = { id: "u", email: "stranger@example.com" };
    const { createProject } = await import("@/lib/actions/projects");
    const result = await createProject({
      owner_user_id: validOwnerId,
      title: "Sneaky project"
    });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("blocks unauthenticated callers", async () => {
    h.state.user = null;
    const { createProject } = await import("@/lib/actions/projects");
    const result = await createProject({
      owner_user_id: validOwnerId,
      title: "Anonymous project"
    });
    expect(result).toEqual({ ok: false, error: "not_authenticated" });
  });

  it("rejects invalid owner_user_id", async () => {
    const { createProject } = await import("@/lib/actions/projects");
    const result = await createProject({ owner_user_id: "bad", title: "Project" });
    expect(result.ok).toBe(false);
  });

  it("rejects 1-char titles", async () => {
    const { createProject } = await import("@/lib/actions/projects");
    const result = await createProject({ owner_user_id: validOwnerId, title: "x" });
    expect(result.ok).toBe(false);
  });

  it("surfaces a Supabase insert error", async () => {
    h.state.insertResult = { data: null, error: { message: "unique violation" } };
    const { createProject } = await import("@/lib/actions/projects");
    const result = await createProject({ owner_user_id: validOwnerId, title: "Dup" });
    expect(result).toEqual({ ok: false, error: "unique violation" });
  });
});

describe("updateProject", () => {
  it("updates when admin + has fields", async () => {
    const { updateProject } = await import("@/lib/actions/projects");
    const result = await updateProject({ id: validId, title: "Renamed" });
    expect(result).toEqual({ ok: true, data: { id: validId } });
  });

  it("rejects no-op (no patch fields)", async () => {
    const { updateProject } = await import("@/lib/actions/projects");
    const result = await updateProject({ id: validId });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no fields/);
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "x@x.com" };
    const { updateProject } = await import("@/lib/actions/projects");
    const result = await updateProject({ id: validId, status: "active" });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects invalid status enum value", async () => {
    const { updateProject } = await import("@/lib/actions/projects");
    const result = await updateProject({
      id: validId,
      status: "bogus" as unknown as "active"
    });
    expect(result.ok).toBe(false);
  });

  it("propagates Supabase update errors", async () => {
    h.state.updateError = { message: "rls violation" };
    const { updateProject } = await import("@/lib/actions/projects");
    const result = await updateProject({ id: validId, title: "Renamed" });
    expect(result).toEqual({ ok: false, error: "rls violation" });
  });
});

describe("deleteProject", () => {
  it("deletes when admin", async () => {
    const { deleteProject } = await import("@/lib/actions/projects");
    const result = await deleteProject({ id: validId });
    expect(result).toEqual({ ok: true, data: { id: validId } });
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "x@x.com" };
    const { deleteProject } = await import("@/lib/actions/projects");
    const result = await deleteProject({ id: validId });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects invalid id", async () => {
    const { deleteProject } = await import("@/lib/actions/projects");
    const result = await deleteProject({ id: "not-uuid" });
    expect(result.ok).toBe(false);
  });

  it("propagates delete errors", async () => {
    h.state.deleteError = { message: "FK violation" };
    const { deleteProject } = await import("@/lib/actions/projects");
    const result = await deleteProject({ id: validId });
    expect(result).toEqual({ ok: false, error: "FK violation" });
  });
});
