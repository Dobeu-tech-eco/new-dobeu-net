import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildStubClient } from "./__test-helpers";

type Assurance = {
  currentLevel: "aal1" | "aal2";
  nextLevel: "aal1" | "aal2";
};

const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    aal: Assurance | null;
    adminClient: unknown;
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    aal: { currentLevel: "aal2", nextLevel: "aal2" },
    adminClient: null,
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
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
  })),
  createAdminClient: vi.fn(() => h.state.adminClient),
}));

const INTAKE_ID = "10000000-0000-4000-8000-000000000001";

type Recorded = {
  table: string;
  method: string;
  args: unknown[];
};

type UpdateResult = {
  data: { id: string; status: "reviewed" | "archived" } | null;
  error: { message: string } | null;
};

function buildAdmin(
  updateResult: UpdateResult = {
    data: { id: INTAKE_ID, status: "reviewed" },
    error: null,
  },
) {
  const base = buildStubClient({ user: h.state.user });
  const recorded: Recorded[] = [];

  const chain = {
    update: vi.fn((...args: unknown[]) => {
      recorded.push({
        table: "typeform_budget_intakes",
        method: "update",
        args,
      });
      return chain;
    }),
    eq: vi.fn((...args: unknown[]) => {
      recorded.push({ table: "typeform_budget_intakes", method: "eq", args });
      return chain;
    }),
    in: vi.fn((...args: unknown[]) => {
      recorded.push({ table: "typeform_budget_intakes", method: "in", args });
      return chain;
    }),
    select: vi.fn((...args: unknown[]) => {
      recorded.push({
        table: "typeform_budget_intakes",
        method: "select",
        args,
      });
      return chain;
    }),
    maybeSingle: vi.fn(async () => {
      recorded.push({
        table: "typeform_budget_intakes",
        method: "maybeSingle",
        args: [],
      });
      return updateResult;
    }),
  };

  const from = vi.fn((table: string) => {
    if (table === "typeform_budget_intakes") return { update: chain.update };
    return base.supabase.from(table);
  });

  return {
    client: { ...base.supabase, from },
    from,
    recorded,
  };
}

function findCall(recorded: Recorded[], method: string): Recorded | undefined {
  return recorded.find((entry) => entry.method === method);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  h.state.aal = { currentLevel: "aal2", nextLevel: "aal2" };
  h.state.adminClient = null;
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

describe("markIntakeReviewed", () => {
  it("guards the source state, records review metadata, and requires a returned row", async () => {
    const admin = buildAdmin();
    h.state.adminClient = admin.client;

    const { markIntakeReviewed } = await import("@/lib/actions/intakes");
    const result = await markIntakeReviewed({
      id: INTAKE_ID,
      notes: "Scope confirmed.",
    });

    expect(result).toEqual({
      ok: true,
      data: { id: INTAKE_ID, status: "reviewed" },
    });
    expect(findCall(admin.recorded, "update")?.args[0]).toMatchObject({
      status: "reviewed",
      review_notes: "Scope confirmed.",
      reviewed_by: "admin_id",
      reviewed_at: expect.any(String),
    });
    expect(findCall(admin.recorded, "in")?.args).toEqual([
      "status",
      ["new", "reviewed"],
    ]);
    expect(findCall(admin.recorded, "select")?.args).toEqual(["id,status"]);
    expect(findCall(admin.recorded, "maybeSingle")).toBeDefined();
    expect(admin.from).not.toHaveBeenCalledWith("admin_audit_log");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/intakes");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/intakes/${INTAKE_ID}`);
  });

  it("blocks unauthenticated and non-admin callers", async () => {
    const admin = buildAdmin();
    h.state.adminClient = admin.client;
    const { markIntakeReviewed } = await import("@/lib/actions/intakes");

    h.state.user = null;
    await expect(markIntakeReviewed({ id: INTAKE_ID })).resolves.toEqual({
      ok: false,
      error: "not_authenticated",
    });

    h.state.user = { id: "user_id", email: "person@example.com" };
    await expect(markIntakeReviewed({ id: INTAKE_ID })).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(findCall(admin.recorded, "update")).toBeUndefined();
  });

  it.each([
    ["unenrolled", { currentLevel: "aal1", nextLevel: "aal1" } as Assurance],
    [
      "not stepped up",
      { currentLevel: "aal1", nextLevel: "aal2" } as Assurance,
    ],
  ])("blocks an %s admin session", async (_label, aal) => {
    const admin = buildAdmin();
    h.state.adminClient = admin.client;
    h.state.aal = aal;
    const { markIntakeReviewed } = await import("@/lib/actions/intakes");

    const result = await markIntakeReviewed({ id: INTAKE_ID });

    expect(result).toEqual({ ok: false, error: "mfa_required" });
    expect(findCall(admin.recorded, "update")).toBeUndefined();
  });

  it("rejects invalid ids and overlong notes before mutating", async () => {
    const admin = buildAdmin();
    h.state.adminClient = admin.client;
    const { markIntakeReviewed } = await import("@/lib/actions/intakes");

    const badId = await markIntakeReviewed({ id: "not-a-uuid" });
    const longNotes = await markIntakeReviewed({
      id: INTAKE_ID,
      notes: "x".repeat(4001),
    });

    expect(badId).toEqual({ ok: false, error: "invalid id" });
    expect(longNotes).toEqual({ ok: false, error: "notes too long" });
    expect(findCall(admin.recorded, "update")).toBeUndefined();
  });
});

describe("archiveIntake / updateIntakeStatus", () => {
  it("archives without reopening archived rows", async () => {
    const admin = buildAdmin({
      data: { id: INTAKE_ID, status: "archived" },
      error: null,
    });
    h.state.adminClient = admin.client;

    const { archiveIntake } = await import("@/lib/actions/intakes");
    const result = await archiveIntake({
      id: INTAKE_ID,
      notes: "Duplicate response.",
    });

    expect(result).toEqual({
      ok: true,
      data: { id: INTAKE_ID, status: "archived" },
    });
    expect(findCall(admin.recorded, "update")?.args[0]).toMatchObject({
      status: "archived",
      review_notes: "Duplicate response.",
      reviewed_by: "admin_id",
      reviewed_at: expect.any(String),
    });
    expect(findCall(admin.recorded, "in")?.args[1]).toEqual([
      "new",
      "reviewed",
    ]);
  });

  it("persists a submitted blank note as null", async () => {
    const admin = buildAdmin({
      data: { id: INTAKE_ID, status: "archived" },
      error: null,
    });
    h.state.adminClient = admin.client;

    const { archiveIntake } = await import("@/lib/actions/intakes");
    const result = await archiveIntake({ id: INTAKE_ID, notes: "   " });

    expect(result.ok).toBe(true);
    expect(findCall(admin.recorded, "update")?.args[0]).toMatchObject({
      review_notes: null,
    });
  });

  it("rejects missing rows and archived-source transitions", async () => {
    const admin = buildAdmin({ data: null, error: null });
    h.state.adminClient = admin.client;

    const { markIntakeReviewed } = await import("@/lib/actions/intakes");
    const result = await markIntakeReviewed({ id: INTAKE_ID });

    expect(result).toEqual({
      ok: false,
      error: "intake_not_found_or_invalid_transition",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects statuses outside the review-only allowlist", async () => {
    const admin = buildAdmin();
    h.state.adminClient = admin.client;

    const { updateIntakeStatus } = await import("@/lib/actions/intakes");
    const result = await updateIntakeStatus({ id: INTAKE_ID, status: "new" });

    expect(result.ok).toBe(false);
    expect(findCall(admin.recorded, "update")).toBeUndefined();
  });

  it("does not expose database errors or revalidate after a failed update", async () => {
    const admin = buildAdmin({
      data: null,
      error: { message: "database unavailable" },
    });
    h.state.adminClient = admin.client;

    const { archiveIntake } = await import("@/lib/actions/intakes");
    const result = await archiveIntake({ id: INTAKE_ID });

    expect(result).toEqual({ ok: false, error: "intake_update_failed" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("atomic review-audit migration", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20260829010000_typeform_budget_intakes.sql",
    ),
    "utf8",
  );

  it("enforces initial state, review metadata, and forward-only transitions", () => {
    expect(sql).toContain(
      "before insert or update on public.typeform_budget_intakes",
    );
    expect(sql).toContain("if tg_op = 'INSERT'");
    expect(sql).toContain("if old.status = 'archived'");
    expect(sql).toContain("if old.status = 'reviewed' and new.status = 'new'");
    expect(sql).toContain(
      "if new.reviewed_by is null or new.reviewed_at is null",
    );
    expect(sql).toContain(
      "after update of status, review_notes, reviewed_by, reviewed_at",
    );
    expect(sql).toContain("old.reviewed_by is distinct from new.reviewed_by");
    expect(sql).toContain("on delete restrict");
  });

  it("revokes direct execution of the security-definer trigger function", () => {
    expect(sql).toContain(
      "revoke execute on function public.audit_typeform_budget_intake_review()",
    );
    expect(sql).toContain("from public, anon, authenticated");
  });
});
