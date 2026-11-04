import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DBClient } from "@/lib/actions/auth";

const h = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => h.admin),
}));

import { listPendingInvites, requireMailboxProof, respondToInvite } from "./company-invites";

type Res = { data?: unknown; error?: { message: string } | null };
type Call = { table: string; op: string; filters: [string, unknown[]][]; payload?: unknown };

/**
 * Service-role fake. `script` maps `table.op` (op = select|update|delete|insert)
 * to a queue of results; every call and filter is recorded for assertions.
 */
function fakeAdmin(script: Record<string, Res[]>) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const call: Call = { table, op: "select", filters: [] };
    calls.push(call);
    const settle = () => {
      const next = script[`${table}.${call.op}`]?.shift() ?? { data: null };
      return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
    };
    const b: Record<string, unknown> = {};
    const setOp = (op: string) => (payload?: unknown) => {
      // `.select()` after update/delete only selects the returning columns.
      if (!(op === "select" && call.op !== "select")) call.op = op;
      if (op !== "select") call.payload = payload;
      return b;
    };
    b.select = setOp("select");
    b.update = setOp("update");
    b.delete = setOp("delete");
    b.insert = setOp("insert");
    for (const f of ["eq", "in"]) {
      b[f] = (...a: unknown[]) => {
        call.filters.push([f, a]);
        return b;
      };
    }
    b.maybeSingle = settle;
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      settle().then(res, rej);
    return b;
  });
  return { admin: { from } as unknown as DBClient, calls };
}

const U = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const ROLES: Res = {
  data: [
    { key: "company_admin", label: "Company Admin", rank: 100 },
    { key: "employee", label: "Employee", rank: 30 },
  ],
};
const ownRowFilters = [
  ["eq", ["id", M]],
  ["eq", ["user_id", U]],
  ["eq", ["status", "invited"]],
];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("respondToInvite accept", () => {
  function acceptScript(over: Record<string, Res[]> = {}) {
    return {
      "company_members.select": [{ data: { company_id: C, role: "employee" } }],
      "companies.select": [{ data: { status: "active" } }, { data: { status: "active" } }],
      "company_roles.select": [ROLES],
      "company_members.update": [{ data: [{ company_id: C, role: "employee" }] }],
      "admin_audit_log.insert": [{ data: null }],
      ...over,
    };
  }

  it("activates only the caller's own invited row and audits it", async () => {
    const { admin, calls } = fakeAdmin(acceptScript());
    const r = await respondToInvite(admin, U, M, "accept");
    expect(r).toEqual({ ok: true, companyId: C, isAdminRole: false });
    const update = calls.find((c) => c.op === "update")!;
    expect(update.table).toBe("company_members");
    expect(update.payload).toEqual({ status: "active" });
    expect(update.filters).toEqual(ownRowFilters);
    const read = calls.find((c) => c.table === "company_members" && c.op === "select")!;
    expect(read.filters).toEqual(ownRowFilters);
    const audit = calls.find((c) => c.table === "admin_audit_log")!;
    expect(audit.payload).toEqual({
      actor_user_id: U,
      action: "company_member.accept",
      target_type: "company",
      target_id: C,
      data: { member_id: M, user_id: U, role: "employee" },
    });
  });

  it("flags an admin-rank role", async () => {
    const { admin } = fakeAdmin(
      acceptScript({
        "company_members.select": [{ data: { company_id: C, role: "company_admin" } }],
        "company_members.update": [{ data: [{ company_id: C, role: "company_admin" }] }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept")).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: true,
    });
  });

  it("another user's, active or disabled row (read finds nothing) is unavailable", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({ "company_members.select": [{ data: null }] }),
    );
    expect(await respondToInvite(admin, U, M, "accept")).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(calls.some((c) => c.op === "update" || c.table === "admin_audit_log")).toBe(false);
  });

  it("a row changed between read and write (zero rows updated) is unavailable and unaudited", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({ "company_members.update": [{ data: [] }] }),
    );
    expect(await respondToInvite(admin, U, M, "accept")).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(calls.some((c) => c.table === "admin_audit_log")).toBe(false);
  });

  it("isAdminRole comes from the written row when the role changed after the read", async () => {
    const { admin } = fakeAdmin(
      acceptScript({
        "company_members.update": [{ data: [{ company_id: C, role: "company_admin" }] }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept")).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: true,
    });
  });

  // Factories: the fake consumes (shift) its queues, so never share arrays.
  const suspendedAfter = () => [{ data: { status: "active" } }, { data: { status: "suspended" } }];
  const written = () => ({ data: [{ company_id: C, role: "employee" }] });

  it("a company suspended after the write is reverted to invited, unaudited", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "companies.select": suspendedAfter(),
        "company_members.update": [written(), { data: [{ id: M }] }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept")).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    const updates = calls.filter((c) => c.op === "update");
    expect(updates).toHaveLength(2);
    expect(updates[1].payload).toEqual({ status: "invited" });
    expect(updates[1].filters).toEqual([
      ["eq", ["id", M]],
      ["eq", ["user_id", U]],
      ["eq", ["status", "active"]],
    ]);
    expect(calls.some((c) => c.table === "admin_audit_log")).toBe(false);
  });

  it.each([
    ["errors", { error: { message: "revert down" } }, "revert_failed"],
    ["matches zero rows", { data: [] }, "revert_no_row"],
  ])("a revert that %s audits the committed accept with its own flag and warns", async (_n, revert, flag) => {
    const warn = vi.spyOn(console, "warn");
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "companies.select": suspendedAfter(),
        "company_members.update": [written(), revert],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept")).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(calls.find((c) => c.table === "admin_audit_log")!.payload).toEqual({
      actor_user_id: U,
      action: "company_member.accept",
      target_type: "company",
      target_id: C,
      data: {
        member_id: M,
        user_id: U,
        role: "employee",
        company_inactive_after_accept: true,
        [flag]: true,
      },
    });
    expect(warn.mock.calls.some((c) => String(c[0]).includes("revert"))).toBe(true);
  });

  it("a failed post-accept re-check keeps the accept and audits it (outer catch not reached)", async () => {
    const warn = vi.spyOn(console, "warn");
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "companies.select": [
          { data: { status: "active" } },
          { error: { message: "read down" } },
        ],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept")).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
    });
    const audit = calls.find((c) => c.table === "admin_audit_log")!;
    expect((audit.payload as { action: string }).action).toBe("company_member.accept");
    expect(calls.filter((c) => c.op === "update")).toHaveLength(1);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("re-check"))).toBe(true);
  });

  it("a suspended company cannot be joined", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({ "companies.select": [{ data: { status: "suspended" } }] }),
    );
    expect(await respondToInvite(admin, U, M, "accept")).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("a database error maps to a fixed code, never the raw message", async () => {
    const { admin } = fakeAdmin(
      acceptScript({ "company_members.update": [{ error: { message: "secret detail" } }] }),
    );
    const r = await respondToInvite(admin, U, M, "accept");
    expect(r).toEqual({ ok: false, error: "invite_response_failed" });
    expect(JSON.stringify(r)).not.toContain("secret");
  });

  it("an audit failure does not undo the accept", async () => {
    const { admin } = fakeAdmin(
      acceptScript({ "admin_audit_log.insert": [{ error: { message: "audit down" } }] }),
    );
    expect(await respondToInvite(admin, U, M, "accept")).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
    });
  });
});

describe("respondToInvite decline", () => {
  it("deletes only the caller's own invited row and audits it", async () => {
    const { admin, calls } = fakeAdmin({
      "company_members.delete": [{ data: [{ company_id: C, role: "employee" }] }],
      "admin_audit_log.insert": [{ data: null }],
    });
    expect(await respondToInvite(admin, U, M, "decline")).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
    });
    const del = calls.find((c) => c.op === "delete")!;
    expect(del.filters).toEqual(ownRowFilters);
    expect(calls.find((c) => c.table === "admin_audit_log")!.payload).toEqual({
      actor_user_id: U,
      action: "company_member.decline",
      target_type: "company",
      target_id: C,
      data: { member_id: M, user_id: U, role: "employee" },
    });
  });

  it("does not look at the company status (a suspended company can be declined)", async () => {
    const { admin, calls } = fakeAdmin({
      "company_members.delete": [{ data: [{ company_id: C, role: "employee" }] }],
    });
    const r = await respondToInvite(admin, U, M, "decline");
    expect(r.ok).toBe(true);
    expect(calls.some((c) => c.table === "companies")).toBe(false);
  });

  it("zero rows deleted is unavailable and unaudited", async () => {
    const { admin, calls } = fakeAdmin({ "company_members.delete": [{ data: [] }] });
    expect(await respondToInvite(admin, U, M, "decline")).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(calls.some((c) => c.table === "admin_audit_log")).toBe(false);
  });
});

describe("listPendingInvites", () => {
  it("returns only the user's invited rows for active companies, with labels", async () => {
    const C2 = "44444444-4444-4444-8444-444444444444";
    const { admin, calls } = fakeAdmin({
      "company_members.select": [
        {
          data: [
            { id: M, company_id: C, role: "company_admin" },
            { id: "m2", company_id: C2, role: "employee" },
          ],
        },
      ],
      // The suspended company is filtered out by the query; only C comes back.
      "companies.select": [{ data: [{ id: C, name: "Acme" }] }],
      "company_roles.select": [ROLES],
    });
    h.admin = admin;
    expect(await listPendingInvites(U)).toEqual({
      invites: [
        {
          memberId: M,
          companyId: C,
          companyName: "Acme",
          role: "company_admin",
          roleLabel: "Company Admin",
          isAdminRole: true,
        },
      ],
      error: false,
    });
    expect(calls[0].filters).toEqual([
      ["eq", ["user_id", U]],
      ["eq", ["status", "invited"]],
    ]);
    expect(calls[1].filters).toContainEqual(["eq", ["status", "active"]]);
  });

  it("returns an empty, non-error list when there are no invites", async () => {
    const { admin, calls } = fakeAdmin({ "company_members.select": [{ data: [] }] });
    h.admin = admin;
    expect(await listPendingInvites(U)).toEqual({ invites: [], error: false });
    expect(calls).toHaveLength(1);
  });

  it("fails soft on a read error", async () => {
    const { admin } = fakeAdmin({
      "company_members.select": [{ error: { message: "boom" } }],
    });
    h.admin = admin;
    expect(await listPendingInvites(U)).toEqual({ invites: [], error: true });
  });

  it("fails soft when the role catalog read fails", async () => {
    const { admin } = fakeAdmin({
      "company_members.select": [{ data: [{ id: M, company_id: C, role: "employee" }] }],
      "companies.select": [{ data: [{ id: C, name: "Acme" }] }],
      "company_roles.select": [{ error: { message: "boom" } }],
    });
    h.admin = admin;
    expect(await listPendingInvites(U)).toEqual({ invites: [], error: true });
  });
});

describe("requireMailboxProof", () => {
  const client = (res: unknown) =>
    ({
      auth: { mfa: { getAuthenticatorAssuranceLevel: vi.fn(async () => res) } },
    }) as unknown as DBClient;
  const withMethods = (methods: unknown[]) =>
    client({ data: { currentAuthenticationMethods: methods }, error: null });

  it.each(["otp", "magiclink", "invite", "email/signup"])("%s proves the mailbox", async (method) => {
    expect(await requireMailboxProof(withMethods([{ method, timestamp: 1 }]))).toBeNull();
  });

  it("accepts a plain-string entry", async () => {
    expect(await requireMailboxProof(withMethods(["otp"]))).toBeNull();
    expect(await requireMailboxProof(withMethods(["password"]))).toBe("invite_email_unconfirmed");
  });

  it("password and totp alone do not count", async () => {
    expect(
      await requireMailboxProof(
        withMethods([{ method: "password", timestamp: 1 }, { method: "totp", timestamp: 2 }]),
      ),
    ).toBe("invite_email_unconfirmed");
  });

  it("a lookup error or empty data is invite_response_failed", async () => {
    expect(await requireMailboxProof(client({ data: null, error: { message: "x" } }))).toBe(
      "invite_response_failed",
    );
    expect(await requireMailboxProof(client({ data: null, error: null }))).toBe(
      "invite_response_failed",
    );
  });
});
