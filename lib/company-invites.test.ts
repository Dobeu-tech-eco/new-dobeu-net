import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DBClient } from "@/lib/actions/auth";

const h = vi.hoisted(() => ({ admin: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => h.admin),
}));

import {
  checkMailboxProof,
  listPendingInvites,
  loadSessionMethods,
  respondToInvite,
  type SessionProof,
} from "./company-invites";

type Res = { data?: unknown; error?: { message: string } | null };
type Call = {
  table: string;
  op: string;
  filters: [string, unknown[]][];
  payload?: unknown;
  /** Columns passed to `.select()` chained after `.update()` / `.delete()`. */
  returning?: string;
};

/**
 * Service-role fake. `script` maps `table.op` (op = select|update|delete|insert)
 * to a queue of results; every call and filter is recorded for assertions.
 * Like PostgREST, an update/delete resolves no rows unless `.select()` was
 * chained after it (L-038): `data` is forced to null in that case, so a write
 * that forgets `.select()` can never look like it matched a row.
 */
function fakeAdmin(script: Record<string, Res[]>) {
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    const call: Call = { table, op: "select", filters: [] };
    calls.push(call);
    const settle = () => {
      const next = script[`${table}.${call.op}`]?.shift() ?? { data: null };
      const writeWithoutSelect =
        (call.op === "update" || call.op === "delete") && call.returning === undefined;
      return Promise.resolve({
        data: writeWithoutSelect ? null : (next.data ?? null),
        error: next.error ?? null,
      });
    };
    const b: Record<string, unknown> = {};
    const setOp = (op: string) => (payload?: unknown) => {
      if (op === "select" && call.op !== "select") {
        // `.select()` after update/delete only selects the returning columns.
        call.returning = String(payload);
        return b;
      }
      call.op = op;
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
const readFilters = [
  ["eq", ["id", M]],
  ["eq", ["user_id", U]],
];

const CREATED = "2026-01-01T00:00:10Z";
/** Email identity; default is a pure creation (created_at == updated_at). */
const eid = (updated: string | null, created: string | null = updated) => ({
  provider: "email",
  created_at: created,
  updated_at: updated,
});
const isoAt = (secs: number) => new Date(secs * 1000).toISOString();
const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const LINK_AT = sec("2026-01-01T00:01:00Z");
const proof = (over: Partial<SessionProof> = {}): SessionProof => ({
  methods: [{ method: "otp", timestamp: LINK_AT }],
  identities: [eid("2026-01-01T00:00:00Z")],
  ...over,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("checkMailboxProof", () => {
  const base = {
    methods: [{ method: "otp", timestamp: LINK_AT }],
    identities: [eid("2026-01-01T00:00:00Z")],
    inviteCreatedAt: CREATED,
  };

  it.each(["otp", "magiclink", "invite", "email/signup"])("%s proves the mailbox", (method) => {
    expect(checkMailboxProof({ ...base, methods: [{ method, timestamp: LINK_AT }] })).toBeNull();
  });

  it.each([
    "password",
    "totp",
    "recovery",
    "email_change",
    "oauth",
    "sso/saml",
    "anonymous",
    "token_refresh",
  ])("%s alone is refused as unconfirmed", (method) => {
    expect(checkMailboxProof({ ...base, methods: [{ method, timestamp: LINK_AT }] })).toBe(
      "invite_email_unconfirmed",
    );
  });

  it("password plus totp is refused, password plus otp passes", () => {
    const m = (method: string) => ({ method, timestamp: LINK_AT });
    expect(checkMailboxProof({ ...base, methods: [m("password"), m("totp")] })).toBe(
      "invite_email_unconfirmed",
    );
    expect(checkMailboxProof({ ...base, methods: [m("password"), m("otp")] })).toBeNull();
  });

  it("string entries carry no timestamp and fail closed, even for a proof method", () => {
    expect(checkMailboxProof({ ...base, methods: ["otp"] })).toBe("invite_email_unconfirmed");
    expect(checkMailboxProof({ ...base, methods: ["otp", "magiclink"] })).toBe(
      "invite_email_unconfirmed",
    );
  });

  it("an entry with a non-numeric timestamp counts as no link entry", () => {
    const methods = [{ method: "otp", timestamp: "x" as unknown as number }];
    expect(checkMailboxProof({ ...base, methods })).toBe("invite_email_unconfirmed");
  });

  it("a link sign-in older than the invite is stale", () => {
    expect(
      checkMailboxProof({ ...base, methods: [{ method: "otp", timestamp: sec(CREATED) - 1 }] }),
    ).toBe("invite_signin_stale");
  });

  it("the newest link entry wins", () => {
    const methods = [
      { method: "otp", timestamp: sec(CREATED) - 100 },
      { method: "magiclink", timestamp: LINK_AT },
    ];
    expect(checkMailboxProof({ ...base, methods })).toBeNull();
  });

  it("an unparseable invite date fails closed as stale", () => {
    expect(checkMailboxProof({ ...base, inviteCreatedAt: "garbage" })).toBe("invite_signin_stale");
  });

  it("an email changed after the link sign-in is refused", () => {
    expect(
      checkMailboxProof({
        ...base,
        identities: [eid("2026-01-01T00:01:01Z")],
      }),
    ).toBe("invite_email_changed");
  });

  it("H-A: an email change requested after the invite is refused even with a newer link sign-in and an old identity", () => {
    expect(
      checkMailboxProof({ ...base, emailChangeSentAt: "2026-01-01T00:00:30Z" }),
    ).toBe("invite_email_changed");
  });

  it("an email change requested after the invite is refused by the 24 h quiet period and by the invite rule", () => {
    // Quiet rule: the change is within 24 h before the link sign-in.
    expect(checkMailboxProof({ ...base, emailChangeSentAt: "2026-01-01T00:00:10.900Z" })).toBe(
      "invite_email_changed",
    );
    // Invite rule alone: the link is days later, so the change is outside the
    // quiet window yet still after the invite was created.
    const late = [{ method: "otp", timestamp: sec(CREATED) + 3 * 86_400 }];
    const afterInvite = new Date((sec(CREATED) + 86_400) * 1000).toISOString();
    expect(checkMailboxProof({ ...base, methods: late, emailChangeSentAt: afterInvite })).toBe(
      "invite_email_changed",
    );
    const inInviteSecond = "2026-01-01T00:00:10.900Z";
    expect(checkMailboxProof({ ...base, methods: late, emailChangeSentAt: inInviteSecond })).toBe(
      "invite_email_changed",
    );
    const beforeInvite = "2026-01-01T00:00:09.999Z";
    expect(checkMailboxProof({ ...base, methods: late, emailChangeSentAt: beforeInvite })).toBeNull();
    expect(checkMailboxProof({ ...base, emailChangeSentAt: null })).toBeNull();
    expect(checkMailboxProof({ ...base, emailChangeSentAt: undefined })).toBeNull();
    expect(checkMailboxProof({ ...base, emailChangeSentAt: "" })).toBeNull();
  });

  it("H-B3: a change requested 5 s before the link with the identity touched 1 s before is refused", () => {
    expect(
      checkMailboxProof({
        ...base,
        emailChangeSentAt: new Date((LINK_AT - 5) * 1000).toISOString(),
        identities: [eid(new Date((LINK_AT - 1) * 1000).toISOString())],
      }),
    ).toBe("invite_email_changed");
  });

  it("a change requested 2 h before the link is refused", () => {
    expect(
      checkMailboxProof({
        ...base,
        emailChangeSentAt: new Date((LINK_AT - 7_200) * 1000).toISOString(),
      }),
    ).toBe("invite_email_changed");
  });

  it("a change 25 h before the link and exactly 86700 s before it are allowed (from a pre-invite change)", () => {
    // Invite created after the change so only the quiet period is in play.
    const linkTs = sec("2026-01-12T12:00:00Z");
    const methods = [{ method: "otp", timestamp: linkTs }];
    const at = (secs: number) => new Date((linkTs - secs) * 1000).toISOString();
    const inviteCreatedAt = "2026-01-11T12:30:00Z";
    for (const secs of [25 * 3_600, 86_700]) {
      expect(
        checkMailboxProof({ ...base, methods, inviteCreatedAt, emailChangeSentAt: at(secs) }),
      ).toBeNull();
    }
    expect(
      checkMailboxProof({ ...base, methods, inviteCreatedAt, emailChangeSentAt: at(86_699) }),
    ).toBe("invite_email_changed");
  });

  it("a first-time confirmed invitee (identity created before the link, no change) is allowed", () => {
    expect(
      checkMailboxProof({
        ...base,
        identities: [eid(new Date((LINK_AT - 30) * 1000).toISOString())],
        emailChangeSentAt: null,
      }),
    ).toBeNull();
  });

  it("H-B4: password change cleared email_change_sent_at but the identity change signal still refuses", () => {
    const held = {
      ...base,
      emailChangeSentAt: null,
      identities: [eid(isoAt(LINK_AT - 10), isoAt(LINK_AT - 30 * 86_400))],
    };
    expect(checkMailboxProof(held)).toBe("invite_email_changed");
    // The change is outside the window: allowed.
    expect(
      checkMailboxProof({
        ...held,
        identities: [eid(isoAt(LINK_AT - 86_700), isoAt(LINK_AT - 30 * 86_400))],
      }),
    ).toBeNull();
    // A missing created_at fails closed.
    expect(
      checkMailboxProof({ ...base, identities: [eid("2026-01-01T00:00:00Z", null)] }),
    ).toBe("invite_email_changed");
  });

  it("decline needs only a link sign-in made after the invite", () => {
    const changed = {
      ...base,
      emailChangeSentAt: new Date((LINK_AT - 5) * 1000).toISOString(),
      identities: [eid(new Date((LINK_AT + 5) * 1000).toISOString())],
    };
    expect(checkMailboxProof(changed)).toBe("invite_email_changed");
    expect(checkMailboxProof({ ...changed, response: "decline" })).toBeNull();
    expect(
      checkMailboxProof({ ...changed, response: "decline", methods: [{ method: "password", timestamp: LINK_AT }] }),
    ).toBe("invite_email_unconfirmed");
    expect(
      checkMailboxProof({
        ...changed,
        response: "decline",
        methods: [{ method: "otp", timestamp: sec(CREATED) - 1 }],
      }),
    ).toBe("invite_signin_stale");
  });

  it("an unparseable email_change_sent_at fails closed", () => {
    expect(checkMailboxProof({ ...base, emailChangeSentAt: "garbage" })).toBe("invite_email_changed");
  });

  it("equal seconds pass at both boundaries", () => {
    // invite created in the same second as the link sign-in
    expect(
      checkMailboxProof({
        ...base,
        methods: [{ method: "otp", timestamp: sec(CREATED) }],
        identities: [eid("2026-01-01T00:00:10.900Z")],
      }),
    ).toBeNull();
    // email identity touched in the same second as the link sign-in
    expect(
      checkMailboxProof({
        ...base,
        identities: [eid("2026-01-01T00:01:00.999Z")],
      }),
    ).toBeNull();
  });

  it("no email identity fails closed (null, undefined, empty or other provider)", () => {
    for (const identities of [null, undefined, [], [{ provider: "github", updated_at: "2020-01-01T00:00:00Z" }]]) {
      expect(checkMailboxProof({ ...base, identities })).toBe("invite_email_changed");
    }
  });

  it("an email identity with no usable updated_at fails closed", () => {
    expect(checkMailboxProof({ ...base, identities: [eid(null)] })).toBe(
      "invite_email_changed",
    );
  });

  it("checks run in order: unconfirmed, then stale, then changed", () => {
    const changed = [eid("2026-01-01T09:00:00Z")];
    const old = [{ method: "otp", timestamp: sec(CREATED) - 5 }];
    expect(checkMailboxProof({ ...base, methods: old, identities: changed })).toBe(
      "invite_signin_stale",
    );
    expect(checkMailboxProof({ ...base, methods: [], identities: changed })).toBe(
      "invite_email_unconfirmed",
    );
  });
});

describe("loadSessionMethods", () => {
  const aal = vi.fn();
  const client = (res: unknown, token: string | null = "tok") => {
    aal.mockReset();
    aal.mockImplementation(async () => res);
    return {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: token ? { access_token: token } : null },
        })),
        mfa: { getAuthenticatorAssuranceLevel: aal },
      },
    } as unknown as DBClient;
  };

  it("passes the session's access token to the AAL lookup", async () => {
    await loadSessionMethods(client({ data: { currentAuthenticationMethods: [] }, error: null }));
    expect(aal).toHaveBeenCalledWith("tok");
  });

  it("returns null without calling the AAL lookup when there is no session token", async () => {
    expect(
      await loadSessionMethods(
        client({ data: { currentAuthenticationMethods: [] }, error: null }, null),
      ),
    ).toBeNull();
    expect(aal).not.toHaveBeenCalled();
  });

  it("returns the session's methods", async () => {
    const methods = [{ method: "otp", timestamp: 1 }];
    expect(
      await loadSessionMethods(client({ data: { currentAuthenticationMethods: methods }, error: null })),
    ).toEqual(methods);
  });

  it("returns null on a lookup error or empty data", async () => {
    expect(await loadSessionMethods(client({ data: null, error: { message: "x" } }))).toBeNull();
    expect(await loadSessionMethods(client({ data: null, error: null }))).toBeNull();
  });
});

// Factories: the fake consumes (shift) its queues, so never share arrays.
const ownRow = (over: Record<string, unknown> = {}) => ({
  data: { company_id: C, role: "employee", created_at: CREATED, status: "invited", ...over },
});
const written = (role = "employee") => ({ data: [{ company_id: C, role }] });
const suspendedAfter = () => [{ data: { status: "active" } }, { data: { status: "suspended" } }];

function acceptScript(over: Record<string, Res[]> = {}): Record<string, Res[]> {
  return {
    "company_members.select": [ownRow()],
    "companies.select": [{ data: { status: "active" } }, { data: { status: "active" } }],
    "company_roles.select": [ROLES],
    "company_members.update": [written()],
    "admin_audit_log.insert": [{ data: null }],
    ...over,
  };
}

const auditOf = (calls: Call[]) => calls.find((c) => c.table === "admin_audit_log");
const wrote = (calls: Call[]) => calls.some((c) => c.op === "update" || c.op === "delete");

describe("respondToInvite accept", () => {
  it("activates only the caller's own invited row, chains .select(), and audits it", async () => {
    const { admin, calls } = fakeAdmin(acceptScript());
    const r = await respondToInvite(admin, U, M, "accept", proof());
    expect(r).toEqual({ ok: true, companyId: C, isAdminRole: false });
    const update = calls.find((c) => c.op === "update")!;
    expect(update.table).toBe("company_members");
    expect(update.payload).toEqual({ status: "active" });
    expect(update.filters).toEqual(ownRowFilters);
    expect(update.returning).toBe("company_id, role");
    const read = calls.find((c) => c.table === "company_members" && c.op === "select")!;
    expect(read.filters).toEqual(readFilters);
    expect(auditOf(calls)!.payload).toEqual({
      actor_user_id: U,
      action: "company_member.accept",
      target_type: "company",
      target_id: C,
      data: { member_id: M, user_id: U, role: "employee" },
    });
  });

  it("the fake resolves no rows when .select() is not chained (L-038 guard)", async () => {
    const { admin } = fakeAdmin({ "company_members.update": [written()] });
    const res = await admin
      .from("company_members")
      .update({ status: "active" } as never)
      .eq("id", M);
    expect(res.data).toBeNull();
  });

  it("flags an admin-rank role", async () => {
    const { admin } = fakeAdmin(
      acceptScript({
        "company_members.select": [ownRow({ role: "company_admin" })],
        "company_members.update": [written("company_admin")],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: true,
    });
  });

  it("another user's row (read finds nothing) is unavailable", async () => {
    const { admin, calls } = fakeAdmin(acceptScript({ "company_members.select": [{ data: null }] }));
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(wrote(calls) || !!auditOf(calls)).toBe(false);
  });

  it("an already active row (double click) succeeds with no write and no audit", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({ "company_members.select": [ownRow({ status: "active", role: "company_admin" })] }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: true,
    });
    expect(wrote(calls) || !!auditOf(calls)).toBe(false);
  });

  it("an already active row on a suspended company is flagged companyInactive", async () => {
    const { admin } = fakeAdmin(
      acceptScript({
        "company_members.select": [ownRow({ status: "active" })],
        "companies.select": [{ data: { status: "suspended" } }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
      companyInactive: true,
    });
  });

  it("an already active row whose company check throws is a plain ok", async () => {
    const { admin } = fakeAdmin(
      acceptScript({
        "company_members.select": [ownRow({ status: "active" })],
        "companies.select": [{ error: { message: "read down" } }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
    });
  });

  it("an already active row succeeds even for a stale session", async () => {
    const { admin } = fakeAdmin(acceptScript({ "company_members.select": [ownRow({ status: "active" })] }));
    const stale = proof({ methods: [{ method: "otp", timestamp: 1 }] });
    expect((await respondToInvite(admin, U, M, "accept", stale)).ok).toBe(true);
  });

  it("a disabled row is unavailable", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({ "company_members.select": [ownRow({ status: "disabled" })] }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(wrote(calls)).toBe(false);
  });

  it.each([
    ["email changed", proof({ identities: [eid("2026-01-02T00:00:00Z")] }), "invite_email_changed"],
    ["email change requested after the invite", proof({ emailChangeSentAt: "2026-01-01T00:00:30Z" }), "invite_email_changed"],
    ["H-B3 change 5 s before the link", proof({ emailChangeSentAt: new Date((LINK_AT - 5) * 1000).toISOString(), identities: [eid(new Date((LINK_AT - 1) * 1000).toISOString())] }), "invite_email_changed"],
    ["H-B4 password change cleared email_change_sent_at, identity changed 10 s before the link", proof({ emailChangeSentAt: null, identities: [eid(isoAt(LINK_AT - 10), isoAt(LINK_AT - 30 * 86_400))] }), "invite_email_changed"],
    ["sign-in older than the invite", proof({ methods: [{ method: "otp", timestamp: sec(CREATED) - 1 }] }), "invite_signin_stale"],
    ["password session", proof({ methods: [{ method: "password", timestamp: LINK_AT }] }), "invite_email_unconfirmed"],
  ] as const)("%s is refused with %s and nothing is written", async (_n, p, code) => {
    const { admin, calls } = fakeAdmin(acceptScript());
    expect(await respondToInvite(admin, U, M, "accept", p)).toEqual({ ok: false, error: code });
    expect(wrote(calls) || !!auditOf(calls)).toBe(false);
  });

  it("a suspended company cannot be joined; the row stays invited", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({ "companies.select": [{ data: { status: "suspended" } }] }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: false,
      error: "invite_company_inactive",
    });
    expect(wrote(calls) || !!auditOf(calls)).toBe(false);
  });

  it("a zero-row write followed by an active re-read is a double-click success, unaudited", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "company_members.update": [{ data: [] }],
        "company_members.select": [
          ownRow(),
          { data: { company_id: C, role: "company_admin", status: "active" } },
        ],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: true,
    });
    expect(auditOf(calls)).toBeUndefined();
    const reread = calls.filter((c) => c.table === "company_members" && c.op === "select")[1];
    expect(reread.filters).toEqual(readFilters);
  });

  it.each([
    ["invited", { data: { company_id: C, role: "employee", status: "invited" } }],
    ["gone", { data: null }],
    ["disabled", { data: { company_id: C, role: "employee", status: "disabled" } }],
  ])("a zero-row write followed by a %s re-read is unavailable and unaudited", async (_n, reread) => {
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "company_members.update": [{ data: [] }],
        "company_members.select": [ownRow(), reread],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(auditOf(calls)).toBeUndefined();
  });

  it("isAdminRole comes from the written row when the role changed after the read", async () => {
    const { admin } = fakeAdmin(acceptScript({ "company_members.update": [written("company_admin")] }));
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: true,
    });
  });

  it("a company suspended after the write is reverted, chains .select(), and audits accept_reverted", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "companies.select": suspendedAfter(),
        "company_members.update": [written(), { data: [{ id: M }] }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: false,
      error: "invite_company_inactive",
    });
    const updates = calls.filter((c) => c.op === "update");
    expect(updates).toHaveLength(2);
    expect(updates[1].payload).toEqual({ status: "invited" });
    expect(updates[1].returning).toBe("id");
    expect(updates[1].filters).toEqual([
      ["eq", ["id", M]],
      ["eq", ["user_id", U]],
      ["eq", ["status", "active"]],
    ]);
    const audits = calls.filter((c) => c.table === "admin_audit_log");
    expect(audits).toHaveLength(1);
    expect(audits[0].payload).toEqual({
      actor_user_id: U,
      action: "company_member.accept_reverted",
      target_type: "company",
      target_id: C,
      data: { member_id: M, user_id: U, role: "employee" },
    });
  });

  it.each([
    ["errors", { error: { message: "revert down" } }, "revert_failed"],
    ["matches zero rows", { data: [] }, "revert_no_row"],
  ])(
    "a revert that %s with the row still active is ok + companyInactive and audits the accept",
    async (_n, revert, flag) => {
      const warn = vi.spyOn(console, "warn");
      const { admin, calls } = fakeAdmin(
        acceptScript({
          "companies.select": suspendedAfter(),
          "company_members.update": [written(), revert],
          "company_members.select": [
            ownRow(),
            { data: { company_id: C, role: "employee", status: "active" } },
          ],
        }),
      );
      expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
        ok: true,
        companyId: C,
        isAdminRole: false,
        companyInactive: true,
      });
      expect(auditOf(calls)!.payload).toEqual({
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
    },
  );

  it("a failed revert whose row is no longer active audits the accept and is unavailable", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "companies.select": suspendedAfter(),
        "company_members.update": [written(), { data: [] }],
        "company_members.select": [ownRow(), { data: null }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    const payload = auditOf(calls)!.payload as { action: string; data: Record<string, unknown> };
    expect(payload.action).toBe("company_member.accept");
    expect(payload.data).toMatchObject({ company_inactive_after_accept: true, revert_no_row: true });
  });

  it("a failed revert whose re-read errors keeps the accept as ok with companyInactive", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "companies.select": suspendedAfter(),
        "company_members.update": [written(), { error: { message: "boom" } }],
        "company_members.select": [ownRow(), { error: { message: "reread boom" } }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
      companyInactive: true,
    });
    const payload = auditOf(calls)!.payload as { action: string; data: Record<string, unknown> };
    expect(payload.action).toBe("company_member.accept");
    expect(payload.data).toMatchObject({
      company_inactive_after_accept: true,
      revert_failed: true,
      reread_failed: true,
    });
  });

  it("a double submit that finds the row active on a suspended company is flagged companyInactive", async () => {
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "companies.select": suspendedAfter(),
        "company_members.update": [{ data: [] }],
        "company_members.select": [
          ownRow(),
          { data: { company_id: C, role: "employee", status: "active" } },
        ],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
      companyInactive: true,
    });
    expect(auditOf(calls)).toBeUndefined();
  });

  it("a failed post-accept re-check keeps the accept and audits it", async () => {
    const warn = vi.spyOn(console, "warn");
    const { admin, calls } = fakeAdmin(
      acceptScript({
        "companies.select": [{ data: { status: "active" } }, { error: { message: "read down" } }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
    });
    expect((auditOf(calls)!.payload as { action: string }).action).toBe("company_member.accept");
    expect(calls.filter((c) => c.op === "update")).toHaveLength(1);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("re-check"))).toBe(true);
  });

  it("a database error maps to a fixed code, never the raw message", async () => {
    const { admin } = fakeAdmin(
      acceptScript({ "company_members.update": [{ error: { message: "secret detail" } }] }),
    );
    const r = await respondToInvite(admin, U, M, "accept", proof());
    expect(r).toEqual({ ok: false, error: "invite_response_failed" });
    expect(JSON.stringify(r)).not.toContain("secret");
  });

  it("an audit failure does not undo the accept", async () => {
    const { admin } = fakeAdmin(
      acceptScript({ "admin_audit_log.insert": [{ error: { message: "audit down" } }] }),
    );
    expect(await respondToInvite(admin, U, M, "accept", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
    });
  });
});

describe("respondToInvite decline", () => {
  const declineScript = (over: Record<string, Res[]> = {}): Record<string, Res[]> => ({
    "company_members.select": [ownRow()],
    "company_members.delete": [{ data: [{ company_id: C, role: "employee" }] }],
    "admin_audit_log.insert": [{ data: null }],
    ...over,
  });

  it("deletes only the caller's own invited row, chains .select(), and audits it", async () => {
    const { admin, calls } = fakeAdmin(declineScript());
    expect(await respondToInvite(admin, U, M, "decline", proof())).toEqual({
      ok: true,
      companyId: C,
      isAdminRole: false,
    });
    const del = calls.find((c) => c.op === "delete")!;
    expect(del.filters).toEqual(ownRowFilters);
    expect(del.returning).toBe("company_id, role");
    expect(auditOf(calls)!.payload).toEqual({
      actor_user_id: U,
      action: "company_member.decline",
      target_type: "company",
      target_id: C,
      data: { member_id: M, user_id: U, role: "employee" },
    });
  });

  it("does not look at the company status (a suspended company can be declined)", async () => {
    const { admin, calls } = fakeAdmin(declineScript());
    expect((await respondToInvite(admin, U, M, "decline", proof())).ok).toBe(true);
    expect(calls.some((c) => c.table === "companies")).toBe(false);
  });

  it("a missing row is unavailable", async () => {
    const { admin, calls } = fakeAdmin(declineScript({ "company_members.select": [{ data: null }] }));
    expect(await respondToInvite(admin, U, M, "decline", proof())).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(wrote(calls)).toBe(false);
  });

  it("an active row is already accepted and is not deleted", async () => {
    const { admin, calls } = fakeAdmin(
      declineScript({ "company_members.select": [ownRow({ status: "active" })] }),
    );
    expect(await respondToInvite(admin, U, M, "decline", proof())).toEqual({
      ok: false,
      error: "invite_already_accepted",
    });
    expect(wrote(calls) || !!auditOf(calls)).toBe(false);
  });

  it("a disabled row is unavailable", async () => {
    const { admin } = fakeAdmin(
      declineScript({ "company_members.select": [ownRow({ status: "disabled" })] }),
    );
    expect(await respondToInvite(admin, U, M, "decline", proof())).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
  });

  it.each([
    ["stale sign-in", proof({ methods: [{ method: "otp", timestamp: sec(CREATED) - 1 }] }), "invite_signin_stale"],
    ["password session", proof({ methods: [{ method: "password", timestamp: LINK_AT }] }), "invite_email_unconfirmed"],
  ] as const)("%s is refused with %s and the row is kept", async (_n, p, code) => {
    const { admin, calls } = fakeAdmin(declineScript());
    expect(await respondToInvite(admin, U, M, "decline", p)).toEqual({ ok: false, error: code });
    expect(wrote(calls) || !!auditOf(calls)).toBe(false);
  });

  it("decline succeeds after an email change that accept refuses", async () => {
    const changed = proof({
      emailChangeSentAt: new Date((LINK_AT - 5) * 1000).toISOString(),
      identities: [eid(new Date((LINK_AT - 1) * 1000).toISOString())],
    });
    const declined = fakeAdmin(declineScript());
    expect((await respondToInvite(declined.admin, U, M, "decline", changed)).ok).toBe(true);
    expect(declined.calls.some((c) => c.op === "delete")).toBe(true);
    const accepted = fakeAdmin(acceptScript());
    expect(await respondToInvite(accepted.admin, U, M, "accept", changed)).toEqual({
      ok: false,
      error: "invite_email_changed",
    });
    expect(wrote(accepted.calls)).toBe(false);
  });

  it("zero rows deleted and the row now active is already accepted, unaudited", async () => {
    const { admin, calls } = fakeAdmin(
      declineScript({
        "company_members.delete": [{ data: [] }],
        "company_members.select": [
          ownRow(),
          { data: { company_id: C, role: "employee", status: "active" } },
        ],
      }),
    );
    expect(await respondToInvite(admin, U, M, "decline", proof())).toEqual({
      ok: false,
      error: "invite_already_accepted",
    });
    expect(auditOf(calls)).toBeUndefined();
  });

  it("zero rows deleted and the row gone is unavailable, unaudited", async () => {
    const { admin, calls } = fakeAdmin(
      declineScript({
        "company_members.delete": [{ data: [] }],
        "company_members.select": [ownRow(), { data: null }],
      }),
    );
    expect(await respondToInvite(admin, U, M, "decline", proof())).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(auditOf(calls)).toBeUndefined();
  });

  it("a database error maps to a fixed code", async () => {
    const { admin } = fakeAdmin(
      declineScript({ "company_members.delete": [{ error: { message: "secret detail" } }] }),
    );
    const r = await respondToInvite(admin, U, M, "decline", proof());
    expect(r).toEqual({ ok: false, error: "invite_response_failed" });
  });
});

describe("listPendingInvites", () => {
  const LINK = Math.floor(Date.parse("2026-11-01T10:00:00.000Z") / 1000);
  const PROVEN = [{ method: "otp", timestamp: LINK }];
  const BEFORE = "2026-10-31T10:00:00.000Z";
  const AFTER = "2026-11-02T10:00:00.000Z";
  const C2 = "44444444-4444-4444-8444-444444444444";

  it("returns the user's invited rows with labels, including suspended companies", async () => {
    const { admin, calls } = fakeAdmin({
      "company_members.select": [
        {
          data: [
            { id: M, company_id: C, role: "company_admin", created_at: BEFORE },
            { id: "m2", company_id: C2, role: "employee", created_at: BEFORE },
          ],
        },
      ],
      "companies.select": [
        {
          data: [
            { id: C, name: "Acme", status: "active" },
            { id: C2, name: "Globex", status: "suspended" },
          ],
        },
      ],
      "company_roles.select": [ROLES],
    });
    h.admin = admin;
    expect(await listPendingInvites(U, PROVEN)).toEqual({
      invites: [
        {
          memberId: M,
          companyId: C,
          companyName: "Acme",
          role: "company_admin",
          roleLabel: "Company Admin",
          isAdminRole: true,
          companyActive: true,
        },
        {
          memberId: "m2",
          companyId: C2,
          companyName: "Globex",
          role: "employee",
          roleLabel: "Employee",
          isAdminRole: false,
          companyActive: false,
        },
      ],
      withheld: 0,
      error: false,
    });
    expect(calls[0].filters).toEqual([
      ["eq", ["user_id", U]],
      ["eq", ["status", "invited"]],
    ]);
    expect(calls[1].filters.some(([, a]) => a[0] === "status")).toBe(false);
  });

  it("drops an invite whose company no longer exists", async () => {
    const { admin } = fakeAdmin({
      "company_members.select": [{ data: [{ id: M, company_id: C, role: "employee", created_at: BEFORE }] }],
      "companies.select": [{ data: [] }],
      "company_roles.select": [ROLES],
    });
    h.admin = admin;
    expect(await listPendingInvites(U, PROVEN)).toEqual({ invites: [], withheld: 0, error: false });
  });

  it("returns an empty, non-error list when there are no invites", async () => {
    const { admin, calls } = fakeAdmin({ "company_members.select": [{ data: [] }] });
    h.admin = admin;
    expect(await listPendingInvites(U, PROVEN)).toEqual({ invites: [], withheld: 0, error: false });
    expect(calls).toHaveLength(1);
  });

  it("fails soft on a read error", async () => {
    const { admin } = fakeAdmin({
      "company_members.select": [{ error: { message: "boom" } }],
    });
    h.admin = admin;
    expect(await listPendingInvites(U, PROVEN)).toEqual({ invites: [], withheld: 0, error: true });
  });

  it("fails soft when the role catalog read fails", async () => {
    const { admin } = fakeAdmin({
      "company_members.select": [{ data: [{ id: M, company_id: C, role: "employee", created_at: BEFORE }] }],
      "companies.select": [{ data: [{ id: C, name: "Acme", status: "active" }] }],
      "company_roles.select": [{ error: { message: "boom" } }],
    });
    h.admin = admin;
    expect(await listPendingInvites(U, PROVEN)).toEqual({ invites: [], withheld: 0, error: true });
  });
  it("withholds details of invites created after the email-link sign-in (count only)", async () => {
    const { admin, calls } = fakeAdmin({
      "company_members.select": [
        {
          data: [
            { id: M, company_id: C, role: "employee", created_at: BEFORE },
            { id: "m2", company_id: C2, role: "employee", created_at: AFTER },
          ],
        },
      ],
      "companies.select": [{ data: [{ id: C, name: "Acme", status: "active" }] }],
      "company_roles.select": [ROLES],
    });
    h.admin = admin;
    const res = await listPendingInvites(U, PROVEN);
    expect(res.withheld).toBe(1);
    expect(res.invites.map((i) => i.memberId)).toEqual([M]);
    // the withheld company is not even looked up
    expect(JSON.stringify(calls[1])).not.toContain(C2);
  });

  it.each([
    ["a password-only session (no link method)", [{ method: "password", timestamp: LINK }]],
    ["no methods", []],
    ["a failed methods lookup (null)", null],
    ["methods not provided", undefined],
  ])("withholds everything for %s", async (_label, methods) => {
    const { admin, calls } = fakeAdmin({
      "company_members.select": [
        { data: [{ id: M, company_id: C, role: "company_admin", created_at: BEFORE }] },
      ],
    });
    h.admin = admin;
    expect(
      await listPendingInvites(U, methods as Parameters<typeof listPendingInvites>[1]),
    ).toEqual({ invites: [], withheld: 1, error: false });
    expect(calls).toHaveLength(1);
  });
});
