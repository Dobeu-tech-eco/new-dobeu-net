// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminEmail } from "@/lib/utils";
import { isAllowlisted, planInvite, runInvite } from "./invite-test-customer.mjs";

const ADMINS = "Admin@Test.Example, second@test.example";

type Row = Record<string, unknown>;

/** Minimal service-role stand-in. `writes` records every mutating call. */
function fakeAdmin(opts: { users?: Array<{ id: string; email: string }>; companyId?: string | null } = {}) {
  const writes: string[] = [];
  const upserts: Array<{ row: Row; options?: Row }> = [];
  const admin = {
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({ data: { users: opts.users ?? [] }, error: null })),
        inviteUserByEmail: vi.fn(async () => {
          writes.push("invite");
          return { data: { user: { id: "new-user" } }, error: null };
        }),
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          limit: async () => ({ data: opts.companyId ? [{ id: opts.companyId }] : [], error: null }),
        }),
        order: () => ({ limit: async () => ({ data: [{ key: "viewer" }], error: null }) }),
      }),
      insert: (row: Row) => {
        writes.push(`insert:${table}`);
        return {
          select: () => ({ single: async () => ({ data: { id: "new-company" }, error: null }) }),
          then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
          row,
        };
      },
      upsert: async (row: Row, options?: Row) => {
        upserts.push({ row, options });
        writes.push(`upsert:${table}:${String(row.role)}`);
        return { error: null };
      },
    }),
  };
  return { admin, writes, upserts };
}

const base = { email: "customer@test.example", adminEmails: ADMINS, log: () => {} };

afterEach(() => vi.unstubAllEnvs());

describe("isAllowlisted", () => {
  it("matches isAdminEmail on a shared fixture", () => {
    vi.stubEnv("ADMIN_EMAILS", ADMINS);
    for (const email of ["admin@test.example", "ADMIN@test.example", " second@test.example", "other@test.example", "", null, undefined]) {
      expect(isAllowlisted(email, ADMINS)).toBe(isAdminEmail(email));
    }
  });
});

describe("planInvite", () => {
  it("refuses an allowlisted address", () => {
    const plan = planInvite({ ...base, email: "ADMIN@test.example", apply: false, withCompany: false });
    expect(plan.ok).toBe(false);
  });

  it("refuses apply when ADMIN_EMAILS is unset, but allows a dry run", () => {
    expect(planInvite({ ...base, adminEmails: undefined, apply: true, withCompany: false }).ok).toBe(false);
    expect(planInvite({ ...base, adminEmails: undefined, apply: false, withCompany: false }).ok).toBe(true);
  });

  it("skips the invite for an existing user and reuses an existing company", () => {
    const plan = planInvite({
      ...base,
      apply: true,
      withCompany: true,
      existingUserId: "u1",
      existingCompanyId: "c1",
    });
    expect(plan).toEqual({
      ok: true,
      steps: ["skip_invite_existing_user", "reuse_company", "upsert_membership", "write_audit"],
    });
  });
});

describe("runInvite", () => {
  it("makes no writes on a dry run", async () => {
    const { admin, writes } = fakeAdmin();
    const result = await runInvite({ ...base, admin, apply: false, withCompany: true });
    expect(result.exitCode).toBe(0);
    expect(result.steps).toContain("invite_user");
    expect(writes).toEqual([]);
  });

  it("refuses an admin address with a non-zero exit and no lookups or writes", async () => {
    const { admin, writes } = fakeAdmin();
    const result = await runInvite({ ...base, admin, email: "admin@test.example", apply: true });
    expect(result.exitCode).toBe(1);
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("refuses apply when ADMIN_EMAILS is unset", async () => {
    const { admin, writes } = fakeAdmin();
    const result = await runInvite({ ...base, admin, adminEmails: "", apply: true });
    expect(result.exitCode).toBe(1);
    expect(writes).toEqual([]);
  });

  it("invites a new user, creates the company, and audits on apply", async () => {
    const { admin, writes } = fakeAdmin();
    const result = await runInvite({ ...base, admin, apply: true, withCompany: true });
    expect(result.exitCode).toBe(0);
    expect(writes).toEqual(["invite", "insert:companies", "upsert:company_members:viewer", "insert:admin_audit_log"]);
  });

  it("does not invite an existing user", async () => {
    const { admin, writes } = fakeAdmin({ users: [{ id: "u1", email: "Customer@test.example" }] });
    const result = await runInvite({ ...base, admin, apply: true });
    expect(result.ids).toEqual({ userId: "u1" });
    expect(admin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    expect(writes).toEqual(["insert:admin_audit_log"]);
  });

  it("reuses an existing company instead of creating one", async () => {
    const { admin, writes } = fakeAdmin({ companyId: "c1" });
    const result = await runInvite({ ...base, admin, apply: true, withCompany: true });
    expect(result.ids.companyId).toBe("c1");
    expect(writes).not.toContain("insert:companies");
    expect(writes).toContain("upsert:company_members:viewer");
  });

  it("refuses a padded, mixed-case admin address before any lookup", async () => {
    const { admin, writes } = fakeAdmin();
    const result = await runInvite({ ...base, admin, email: " ADMIN@Test.Example ", apply: true });
    expect(result.exitCode).toBe(1);
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    expect(admin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("normalizes the email before inviting", async () => {
    const { admin } = fakeAdmin();
    await runInvite({ ...base, admin, email: "  Customer@Test.Example ", apply: true });
    expect(admin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "customer@test.example",
      expect.anything(),
    );
  });

  it("refuses when the resolved user's stored email is an admin, even if the argument was not", async () => {
    // The lookup matches the argument case-insensitively, so the stored address
    // can only be flagged by the second check. Simulate a stored value that the
    // lookup accepts but the allowlist recognises.
    let reads = 0;
    const storedUser = {
      id: "u9",
      get email() {
        reads += 1;
        return reads === 1 ? "customer@test.example" : "second@test.example";
      },
    };
    const { admin, writes } = fakeAdmin();
    admin.auth.admin.listUsers.mockResolvedValueOnce({ data: { users: [storedUser] }, error: null });
    const result = await runInvite({ ...base, admin, apply: true, withCompany: true });
    expect(result.exitCode).toBe(1);
    expect(admin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("upserts the membership on (company_id,user_id) as active with the lowest-rank role", async () => {
    const { admin, upserts } = fakeAdmin({ companyId: "c1" });
    await runInvite({ ...base, admin, apply: true, withCompany: true });
    expect(upserts).toEqual([
      {
        row: { company_id: "c1", user_id: "new-user", role: "viewer", status: "active" },
        options: { onConflict: "company_id,user_id" },
      },
    ]);
  });

  it("prints no secrets or invite links", async () => {
    const lines: string[] = [];
    const { admin } = fakeAdmin();
    await runInvite({ ...base, admin, apply: true, log: (l: string) => lines.push(l) });
    expect(lines.join("\n")).not.toMatch(/key|token|http/i);
  });
});
