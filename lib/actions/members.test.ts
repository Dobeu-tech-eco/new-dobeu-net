import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildStubClient } from "./__test-helpers";

// Mutable holder: each test swaps in a differently-configured cookie client and
// tunes the service-role auth-admin responses.
const h = vi.hoisted(() => {
  const state: {
    client: unknown;
    createResult: {
      data: { user: { id: string } | null } | null;
      error: { message?: string; code?: string; status?: number } | null;
    };
    users: { id: string; email: string }[];
    // Successive listUsers results; falls back to `users` when exhausted.
    userSequence: { id: string; email: string }[][];
    events: string[];
    sendResult: { ok: boolean; id?: string; error?: string };
    sendThrows: boolean;
    resendConfigured: boolean;
    listError: { message: string } | null;
    limitThrows: boolean;
    counts: Map<string, number>;
  } = {
    client: null,
    createResult: { data: { user: { id: "new_user_1" } }, error: null },
    users: [],
    userSequence: [],
    events: [],
    sendResult: { ok: true, id: "email_1" },
    sendThrows: false,
    resendConfigured: true,
    listError: null,
    limitThrows: false,
    counts: new Map(),
  };
  return {
    state,
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    sendEmail: vi.fn(),
    redirect: vi.fn(),
  };
});

// Deterministic limiter: a counter per key, resettable per test, can throw.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async (key: string, opts: { max: number }) => {
    if (h.state.limitThrows) throw new Error("redis down");
    const count = (h.state.counts.get(key) ?? 0) + 1;
    h.state.counts.set(key, count);
    return { limited: count > opts.max, count, backend: "memory" };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    h.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/resend", () => ({
  isResendConfigured: () => h.state.resendConfigured,
  sendEmail: h.sendEmail,
}));

import { createAdminClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.state.client),
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: h.createUser,
        deleteUser: h.deleteUser,
        listUsers: vi.fn(async () => {
          h.state.events.push("listUsers");
          if (h.state.listError) {
            return { data: null, error: h.state.listError };
          }
          return {
            data: {
              users: h.state.userSequence.length
                ? h.state.userSequence.shift()
                : h.state.users,
            },
            error: null,
          };
        }),
      },
    },
  })),
}));

import {
  inviteMember,
  inviteMemberForm,
  changeMemberRole,
  deactivateMember,
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
  user_id: "other_user",
};

const AAL2 = { currentLevel: "aal2", nextLevel: "aal2" };
const AAL1 = { currentLevel: "aal1", nextLevel: "aal2" };

// Calls recorded by the most recent makeClient() stub (table + method + args).
let recorded: ReturnType<typeof buildStubClient>["recorded"] = [];

function makeClient(
  opts: {
    aal?: { currentLevel: string; nextLevel: string };
    companyStatus?: string;
    user?: { id: string; email: string } | null;
    member?: Record<string, unknown> | null;
    rank?: number;
    roleValid?: boolean;
    insert?: {
      data?: unknown;
      error?: { message: string; code?: string } | null;
    };
    update?: { error?: { message: string } | null };
  } = {},
) {
  const {
    aal = AAL2,
    companyStatus = "active",
    user = { id: "admin_1", email: "admin@dobeu.net" },
    member = ADMIN_MEMBER,
    rank = 100,
    roleValid = true,
    insert = { data: { id: "m_new" } },
    update = { error: null },
  } = opts;
  const stub = buildStubClient({
    user,
    tables: {
      company_members: { selectSingle: { data: member }, insert, update },
      company_roles: {
        selectSingle: { data: roleValid ? { key: "employee", rank } : null },
      },
      companies: { selectSingle: { data: { status: companyStatus } } },
    },
  });
  recorded = stub.recorded;
  const originalFrom = stub.supabase.from.bind(stub.supabase);
  stub.supabase.from = ((table: string) => {
    const q = originalFrom(table) as { insert: (...a: unknown[]) => unknown };
    const insert = q.insert.bind(q);
    q.insert = (...args: unknown[]) => {
      if (table === "company_members") h.state.events.push("insert");
      return insert(...args);
    };
    return q;
  }) as typeof stub.supabase.from;
  return Object.assign(stub.supabase, {
    auth: {
      ...stub.supabase.auth,
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: aal,
          error: null,
        })),
      },
    },
  });
}

// Writes the guard must prevent: member-row mutations and service-role access.
function expectNoWritesOrAdminCalls() {
  expect(
    recorded.filter(
      (r) =>
        r.table === "company_members" &&
        (r.method === "insert" || r.method === "update"),
    ),
  ).toEqual([]);
  expect(createAdminClient).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://admin-test.example");
  h.state.client = makeClient();
  h.state.createResult = { data: { user: { id: "new_user_1" } }, error: null };
  h.state.users = [];
  h.state.userSequence = [];
  h.state.events = [];
  h.state.sendResult = { ok: true, id: "email_1" };
  h.state.sendThrows = false;
  h.state.resendConfigured = true;
  h.state.listError = null;
  h.state.limitThrows = false;
  h.state.counts = new Map();
  h.createUser.mockImplementation(async () => {
    h.state.events.push("createUser");
    return h.state.createResult;
  });
  h.deleteUser.mockImplementation(async () => {
    h.state.events.push("deleteUser");
    return { error: null };
  });
  h.sendEmail.mockImplementation(async () => {
    h.state.events.push("sendEmail");
    if (h.state.sendThrows) throw new Error("boom");
    return h.state.sendResult;
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("inviteMember", () => {
  const invite = (emailAddr = "client@example.com") =>
    inviteMember(COMPANY_ID, emailAddr, "employee");

  it("creates an unconfirmed user, inserts the member, then sends the invite", async () => {
    h.state.client = makeClient({ user: { id: "inv_new", email: "a@d.net" } });
    const result = await invite();
    expect(result).toEqual({
      ok: true,
      data: {
        id: "m_new",
        user_id: "new_user_1",
        email: "client@example.com",
        emailSent: true,
      },
    });
    expect(h.createUser).toHaveBeenCalledWith({
      email: "client@example.com",
      email_confirm: false,
    });
    expect(h.state.events).toEqual(["createUser", "insert", "sendEmail"]);
  });

  it("sends fixed copy linking to /login?next=/company with no token", async () => {
    h.state.client = makeClient({ user: { id: "inv_copy", email: "a@d.net" } });
    await invite();
    const arg = h.sendEmail.mock.calls[0][0] as {
      to: string;
      html: string;
      text: string;
    };
    expect(arg.to).toBe("client@example.com");
    expect(arg.text).toContain("https://admin-test.example/login?next=/company");
    expect(arg.html + arg.text).not.toMatch(/token|code=|auth\/callback/i);
  });

  it("existing user: createUser first, then lookup, insert, then the email (R2)", async () => {
    h.state.client = makeClient({
      user: { id: "inv_existing", email: "a@d.net" },
    });
    h.state.users = [{ id: "existing_9", email: "Client@Example.com" }];
    h.state.createResult = {
      data: { user: null },
      error: { code: "email_exists", status: 422 },
    };
    const result = await invite();
    expect(result).toEqual({
      ok: true,
      data: {
        id: "m_new",
        user_id: "existing_9",
        email: "client@example.com",
        emailSent: true,
      },
    });
    expect(h.state.events).toEqual([
      "createUser",
      "listUsers",
      "insert",
      "sendEmail",
    ]);
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("createUser already-registered: looks the user up, never deletes", async () => {
    h.state.client = makeClient({ user: { id: "inv_race", email: "a@d.net" } });
    h.state.createResult = {
      data: { user: null },
      error: { code: "email_exists", status: 422 },
    };
    h.state.userSequence = [[{ id: "raced_7", email: "client@example.com" }]];
    const result = await invite();
    expect(result).toMatchObject({
      ok: true,
      data: { user_id: "raced_7", emailSent: true },
    });
    expect(h.state.events).toEqual([
      "createUser",
      "listUsers",
      "insert",
      "sendEmail",
    ]);
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("new email: no listUsers paging at all (createUser first)", async () => {
    h.state.client = makeClient({ user: { id: "inv_nolist", email: "a@d.net" } });
    await invite();
    expect(h.state.events).not.toContain("listUsers");
  });

  it("createUser returning an id AND already-registered never sets createdByUs", async () => {
    h.state.client = makeClient({
      user: { id: "inv_both", email: "a@d.net" },
      insert: { error: { message: "raw pg text", code: "23505" } },
    });
    h.state.createResult = {
      data: { user: { id: "existing_both" } },
      error: { code: "email_exists", status: 422 },
    };
    expect(await invite()).toEqual({ ok: false, error: "already_member" });
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("listUsers error after already-registered: fails, no insert, no send, no delete", async () => {
    h.state.client = makeClient({ user: { id: "inv_lerr", email: "a@d.net" } });
    h.state.createResult = {
      data: { user: null },
      error: { code: "email_exists", status: 422 },
    };
    h.state.listError = { message: "db secret detail" };
    expect(await invite()).toEqual({ ok: false, error: "invite failed" });
    expect(recorded.filter((r) => r.method === "insert")).toEqual([]);
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("returns a generic failure when the user cannot be created or resolved", async () => {
    h.state.client = makeClient({ user: { id: "inv_fail", email: "a@d.net" } });
    h.state.createResult = { data: { user: null }, error: { message: "smtp down" } };
    const result = await invite();
    expect(result).toEqual({ ok: false, error: "invite failed" });
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(recorded.filter((r) => r.method === "insert")).toEqual([]);
  });

  it("insert error for a created user: no email, user deleted", async () => {
    h.state.client = makeClient({
      user: { id: "inv_dup", email: "a@d.net" },
      insert: { error: { message: "duplicate key value" } },
    });
    const result = await invite();
    expect(result).toEqual({ ok: false, error: "invite failed" });
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.deleteUser).toHaveBeenCalledWith("new_user_1");
    expect(h.state.events).toEqual(["createUser", "insert", "deleteUser"]);
  });

  it("insert error for an existing user: no email, user NOT deleted", async () => {
    h.state.client = makeClient({
      user: { id: "inv_dup2", email: "a@d.net" },
      insert: { error: { message: "duplicate key value" } },
    });
    h.state.users = [{ id: "existing_9", email: "client@example.com" }];
    h.state.createResult = {
      data: { user: null },
      error: { code: "email_exists", status: 422 },
    };
    const result = await invite();
    expect(result).toEqual({ ok: false, error: "invite failed" });
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("23505 maps to already_member and never leaks the raw message", async () => {
    h.state.client = makeClient({
      user: { id: "inv_23505", email: "a@d.net" },
      insert: {
        error: {
          message: 'duplicate key value violates unique constraint "x"',
          code: "23505",
        },
      },
    });
    const result = await invite();
    expect(result).toEqual({ ok: false, error: "already_member" });
    expect(h.sendEmail).not.toHaveBeenCalled();
    expect(h.deleteUser).toHaveBeenCalledWith("new_user_1");
  });

  it("send failure keeps the membership and flags a partial result", async () => {
    h.state.client = makeClient({ user: { id: "inv_sf", email: "a@d.net" } });
    h.state.sendResult = { ok: false, error: "resend down" };
    expect(await invite()).toEqual({
      ok: true,
      data: {
        id: "m_new",
        user_id: "new_user_1",
        email: "client@example.com",
        emailSent: false,
        partial: "invite_email_failed",
      },
    });
    expect(h.deleteUser).not.toHaveBeenCalled();
  });

  it("a throwing send is treated as a send failure, after the insert", async () => {
    h.state.client = makeClient({ user: { id: "inv_st", email: "a@d.net" } });
    h.state.sendThrows = true;
    expect(await invite()).toMatchObject({
      ok: true,
      data: { emailSent: false, partial: "invite_email_failed" },
    });
    expect(h.deleteUser).not.toHaveBeenCalled();
    expect(h.state.events).toEqual(["createUser", "insert", "sendEmail"]);
  });

  it("resend not configured counts as a send failure (R4)", async () => {
    h.state.client = makeClient({ user: { id: "inv_nc", email: "a@d.net" } });
    h.state.resendConfigured = false;
    expect(await invite()).toMatchObject({
      ok: true,
      data: { id: "m_new", emailSent: false, partial: "invite_email_failed" },
    });
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it("blocks a non-admin caller (rank below 100)", async () => {
    h.state.client = makeClient({
      user: { id: "inv_mgr", email: "mgr@dobeu.net" },
      member: { role: "manager", status: "active" },
      rank: 60,
    });
    const result = await inviteMember(
      COMPANY_ID,
      "client@example.com",
      "employee",
    );
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("blocks an unauthenticated caller", async () => {
    h.state.client = makeClient({ user: null });
    const result = await inviteMember(
      COMPANY_ID,
      "client@example.com",
      "employee",
    );
    expect(result).toEqual({ ok: false, error: "not_authenticated" });
  });

  it("rejects an invalid email", async () => {
    const result = await inviteMember(COMPANY_ID, "not-an-email", "employee");
    expect(result.ok).toBe(false);
  });

  it("rate-limits a single admin after the per-minute max", async () => {
    h.state.client = makeClient({
      user: { id: "rl_admin", email: "rl@dobeu.net" },
    });
    for (let i = 0; i < 5; i++) {
      expect((await invite(`person${i}@example.com`)).ok).toBe(true);
    }
    expect(await invite("one-more@example.com")).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("caps invites per company per 24h (daily_limit) across admins", async () => {
    h.state.counts.set(`invite:day:${COMPANY_ID}`, 20);
    h.state.client = makeClient({ user: { id: "day_admin", email: "d@d.net" } });
    expect(await invite("late@example.com")).toEqual({
      ok: false,
      error: "daily_limit",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(h.createUser).not.toHaveBeenCalled();
  });

  it("the 20th invite of the day still goes through", async () => {
    h.state.counts.set(`invite:day:${COMPANY_ID}`, 19);
    h.state.client = makeClient({ user: { id: "day_ok", email: "d@d.net" } });
    expect((await invite("ok@example.com")).ok).toBe(true);
  });

  it("per-minute is checked before daily (a minute hit does not burn a daily slot)", async () => {
    h.state.counts.set("invite:min:min_first", 5);
    h.state.client = makeClient({ user: { id: "min_first", email: "m@d.net" } });
    expect(await invite("x@example.com")).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(h.state.counts.get(`invite:day:${COMPANY_ID}`)).toBeUndefined();
  });

  it("a limiter throw fails closed as rate_limited, before any auth-admin call", async () => {
    h.state.limitThrows = true;
    h.state.client = makeClient({ user: { id: "rl_throw", email: "t@d.net" } });
    expect(await invite("t@example.com")).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(h.createUser).not.toHaveBeenCalled();
  });

  it("rate limiting happens before any auth-admin call (R6)", async () => {
    h.state.client = makeClient({
      user: { id: "rl_admin_2", email: "rl2@dobeu.net" },
    });
    for (let i = 0; i < 5; i++) await invite(`p${i}@example.com`);
    vi.mocked(createAdminClient).mockClear();
    h.createUser.mockClear();
    expect(await invite("extra@example.com")).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(h.createUser).not.toHaveBeenCalled();
  });
});

describe("inviteMemberForm", () => {
  const submit = async (companyId: string, email = "client@example.com") => {
    const fd = new FormData();
    fd.set("email", email);
    fd.set("roleKey", "employee");
    await expect(inviteMemberForm(companyId, fd)).rejects.toThrow(
      /NEXT_REDIRECT/,
    );
    return h.redirect.mock.calls[h.redirect.mock.calls.length - 1][0] as string;
  };
  const base = `/company/members?company=${COMPANY_ID}&notice=`;

  it("redirects member_added when the email was sent", async () => {
    h.state.client = makeClient({ user: { id: "f_ok", email: "a@d.net" } });
    expect(await submit(COMPANY_ID)).toBe(`${base}member_added`);
  });

  it("redirects invite_email_failed on a partial result", async () => {
    h.state.client = makeClient({ user: { id: "f_partial", email: "a@d.net" } });
    h.state.sendResult = { ok: false };
    expect(await submit(COMPANY_ID)).toBe(`${base}invite_email_failed`);
  });

  it("redirects rate_limited when the limiter trips", async () => {
    h.state.client = makeClient({ user: { id: "f_rl", email: "a@d.net" } });
    for (let i = 0; i < 5; i++) await inviteMember(COMPANY_ID, `r${i}@example.com`, "employee");
    expect(await submit(COMPANY_ID)).toBe(`${base}rate_limited`);
  });

  it("redirects daily_limit when the company cap is hit", async () => {
    h.state.counts.set(`invite:day:${COMPANY_ID}`, 20);
    h.state.client = makeClient({ user: { id: "f_day", email: "a@d.net" } });
    expect(await submit(COMPANY_ID)).toBe(`${base}daily_limit`);
  });

  it("redirects rate_limited when the limiter throws", async () => {
    h.state.limitThrows = true;
    h.state.client = makeClient({ user: { id: "f_thr", email: "a@d.net" } });
    expect(await submit(COMPANY_ID)).toBe(`${base}rate_limited`);
  });

  it("redirects already_member on a unique violation", async () => {
    h.state.client = makeClient({
      user: { id: "f_dup", email: "a@d.net" },
      insert: { error: { message: "dup", code: "23505" } },
    });
    expect(await submit(COMPANY_ID)).toBe(`${base}already_member`);
  });

  it("redirects mfa_required for an AAL1 admin", async () => {
    h.state.client = makeClient({ aal: AAL1 });
    expect(await submit(COMPANY_ID)).toBe(`${base}mfa_required`);
  });

  it("redirects forbidden for a non-admin", async () => {
    h.state.client = makeClient({
      member: { role: "manager", status: "active" },
      rank: 60,
    });
    expect(await submit(COMPANY_ID)).toBe(`${base}forbidden`);
  });

  it("redirects forbidden when signed out", async () => {
    h.state.client = makeClient({ user: null });
    expect(await submit(COMPANY_ID)).toBe(`${base}forbidden`);
  });

  it("redirects invite_failed on an other insert error", async () => {
    h.state.client = makeClient({
      user: { id: "f_ins", email: "a@d.net" },
      insert: { error: { message: "x" } },
    });
    expect(await submit(COMPANY_ID)).toBe(`${base}invite_failed`);
  });

  it("redirects invite_failed when createUser fails", async () => {
    h.state.client = makeClient({ user: { id: "f_cu", email: "a@d.net" } });
    h.state.createResult = { data: { user: null }, error: { message: "boom" } };
    expect(await submit(COMPANY_ID)).toBe(`${base}invite_failed`);
  });

  it("redirects invite_failed on validation failure", async () => {
    expect(await submit(COMPANY_ID, "not-an-email")).toBe(`${base}invite_failed`);
  });

  it("drops company= when companyId is not a guid", async () => {
    expect(await submit("not-a-guid")).toBe(
      "/company/members?notice=invite_failed",
    );
  });
});

describe("changeMemberRole", () => {
  it("updates a member's role when admin", async () => {
    const result = await changeMemberRole(COMPANY_ID, MEMBER_ID, "manager");
    expect(result).toEqual({ ok: true, data: { id: MEMBER_ID } });
  });

  it("blocks a non-admin caller", async () => {
    h.state.client = makeClient({
      member: { role: "manager", status: "active" },
      rank: 60,
    });
    const result = await changeMemberRole(COMPANY_ID, MEMBER_ID, "employee");
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects an invalid member id", async () => {
    const result = await changeMemberRole(COMPANY_ID, "bad", "employee");
    expect(result.ok).toBe(false);
  });

  it("propagates a Supabase update error", async () => {
    h.state.client = makeClient({
      update: { error: { message: "rls violation" } },
    });
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
      member: {
        role: "company_admin",
        status: "active",
        id: MEMBER_ID,
        user_id: "self_1",
      },
    });
    const result = await deactivateMember(COMPANY_ID, MEMBER_ID);
    expect(result).toEqual({ ok: false, error: "cannot disable yourself" });
  });

  it("blocks a non-admin caller", async () => {
    h.state.client = makeClient({
      member: { role: "employee", status: "active" },
      rank: 30,
    });
    const result = await deactivateMember(COMPANY_ID, MEMBER_ID);
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("propagates a Supabase update error", async () => {
    h.state.client = makeClient({
      update: { error: { message: "rls violation" } },
    });
    const result = await deactivateMember(COMPANY_ID, MEMBER_ID);
    expect(result).toEqual({ ok: false, error: "rls violation" });
  });
});

describe("D28 guard in the action path (AAL2 + active company)", () => {
  const actions: [string, () => ReturnType<typeof inviteMember | typeof changeMemberRole>][] = [
    ["inviteMember", () => inviteMember(COMPANY_ID, "client@example.com", "employee")],
    ["changeMemberRole", () => changeMemberRole(COMPANY_ID, MEMBER_ID, "manager")],
    ["deactivateMember", () => deactivateMember(COMPANY_ID, MEMBER_ID)],
  ];

  it.each(actions)("%s: AAL1 admin gets mfa_required, no writes", async (_n, run) => {
    h.state.client = makeClient({ aal: AAL1 });
    expect(await run()).toEqual({ ok: false, error: "mfa_required" });
    expectNoWritesOrAdminCalls();
  });

  it.each(actions)("%s: suspended company gets forbidden, no writes", async (_n, run) => {
    h.state.client = makeClient({ companyStatus: "suspended" });
    expect(await run()).toEqual({ ok: false, error: "forbidden" });
    expectNoWritesOrAdminCalls();
  });
});
