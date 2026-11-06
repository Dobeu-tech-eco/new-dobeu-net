import { beforeEach, describe, expect, it, vi } from "vitest";

const updateUserById = vi.fn();
const scheduled = vi.hoisted(() => ({ queue: [] as Promise<unknown>[], throws: false }));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    if (scheduled.throws) throw new Error("outside request scope");
    scheduled.queue.splice(scheduled.queue.length, 0, Promise.resolve().then(fn));
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ auth: { admin: { updateUserById } } })),
}));

import { hasCurrentEmailLinkSignIn, recordEmailLinkSignIn } from "@/lib/email-link-signin";

// Session created (amr timestamp) at LINK_TS.
const LINK_TS = Math.floor(Date.parse("2026-11-01T10:00:05.000Z") / 1000);

/** Email identity; default is a pure creation (created_at == updated_at). */
const eid = (updated: string, created: string = updated) => ({
  provider: "email",
  created_at: created,
  updated_at: updated,
});

type Method = string | { method: string; timestamp?: number };
type UserOver = Record<string, unknown>;

function client(
  methods: Method[],
  opts: { aalError?: boolean; user?: UserOver } = {},
) {
  const user = {
    id: "u1",
    email: "me@example.com",
    email_change_sent_at: null,
    identities: [eid("2026-10-01T00:00:00.000Z")],
    ...opts.user,
  };
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () =>
          opts.aalError
            ? { data: null, error: new Error("x") }
            : { data: { currentAuthenticationMethods: methods }, error: null },
        ),
      },
    },
  };
}
/** Schedules the marker write (as the route does) and waits for after() work. */
async function record(c: unknown): Promise<void> {
  recordEmailLinkSignIn(c);
  await Promise.all(scheduled.queue.splice(0));
}
const m = (method: string) => ({ method, timestamp: LINK_TS });

beforeEach(() => {
  updateUserById.mockReset();
  updateUserById.mockResolvedValue({ error: null });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("recordEmailLinkSignIn", () => {
  it("defers the write to after(): nothing runs synchronously", async () => {
    const c = client([m("otp")]);
    recordEmailLinkSignIn(c);
    expect(c.auth.getUser).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
    await Promise.all(scheduled.queue.splice(0));
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it("does not throw when after() cannot be scheduled", () => {
    scheduled.throws = true;
    try {
      expect(() => recordEmailLinkSignIn(client([m("otp")]))).not.toThrow();
    } finally {
      scheduled.throws = false;
    }
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it.each(["otp", "magiclink", "invite", "email/signup"])("writes the marker for %s, stamped with the amr timestamp", async (method) => {
    await record(client([m(method)]));
    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(updateUserById).toHaveBeenCalledWith("u1", {
      app_metadata: {
        email_link_signin: { at: "2026-11-01T10:00:05.000Z", email: "me@example.com" },
      },
    });
  });

  it("uses the newest link entry's timestamp, not the wall clock", async () => {
    await record(
      client([{ method: "otp", timestamp: LINK_TS - 100 }, m("magiclink"), { method: "password", timestamp: LINK_TS + 50 }]),
    );
    const at = updateUserById.mock.calls[0][1].app_metadata.email_link_signin.at;
    expect(at).toBe("2026-11-01T10:00:05.000Z");
  });

  it("fails closed for string-shaped or timestamp-less entries", async () => {
    await record(client(["magiclink", { method: "otp" }]));
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it.each([["password"], ["totp"], ["password", "totp"]])("does not write for %s", async (...methods) => {
    await record(client(methods.map(m)));
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("does not write when the assurance lookup errors", async () => {
    await record(client([], { aalError: true }));
    expect(updateUserById).not.toHaveBeenCalled();
  });

  const iso = (secs: number) => new Date(secs * 1000).toISOString();

  it("H-B3: change requested 5 s before the link, identity updated 1 s before: no marker", async () => {
    await record(
      client([m("magiclink")], {
        user: {
          email: "victim@example.com",
          email_change_sent_at: iso(LINK_TS - 5),
          identities: [eid(iso(LINK_TS - 1))],
        },
      }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("marker skipped"));
  });

  it("H-B4: password change cleared email_change_sent_at; identity change signal still refuses", async () => {
    await record(
      client([m("magiclink")], {
        user: {
          email: "victim@example.com",
          email_change_sent_at: null,
          identities: [eid(iso(LINK_TS - 10), iso(LINK_TS - 30 * 86_400))],
        },
      }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[email-link-signin] marker skipped: email-change quiet check failed",
    );
  });

  it("an identity changed long before the link (outside the window) still writes the marker", async () => {
    await record(
      client([m("magiclink")], {
        user: { identities: [eid(iso(LINK_TS - 86_700), iso(LINK_TS - 30 * 86_400))] },
      }),
    );
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it("a change requested 2 h before the link (inside the quiet period) skips the marker", async () => {
    await record(
      client([m("magiclink")], { user: { email_change_sent_at: iso(LINK_TS - 7_200) } }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("an identity confirmed after the sign-in skips the marker even without email_change_sent_at", async () => {
    await record(
      client([m("magiclink")], {
        user: { identities: [eid(iso(LINK_TS + 1))] },
      }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("a change 25 h before and exactly 86700 s before the link write the marker; 86699 s does not", async () => {
    for (const secs of [25 * 3_600, 86_700]) {
      updateUserById.mockClear();
      await record(
        client([m("magiclink")], {
          user: {
            email_change_sent_at: iso(LINK_TS - secs),
            identities: [eid(iso(LINK_TS - secs),iso(LINK_TS - 30 * 86_400))],
          },
        }),
      );
      expect(updateUserById).toHaveBeenCalledTimes(1);
    }
    updateUserById.mockClear();
    await record(
      client([m("magiclink")], { user: { email_change_sent_at: iso(LINK_TS - 86_699) } }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("a first-time confirmed invitee (identity created before the link) writes the marker", async () => {
    await record(
      client([m("email/signup")], {
        user: { identities: [eid(iso(LINK_TS - 4))] },
      }),
    );
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it("fails closed on an unparseable email_change_sent_at, a missing identity or an unparseable updated_at", async () => {
    await record(client([m("otp")], { user: { email_change_sent_at: "garbage" } }));
    await record(client([m("otp")], { user: { identities: [] } }));
    await record(
      client([m("otp")], { user: { identities: [eid("nope")] } }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("swallows an admin update error, a thrown update and a broken client", async () => {
    updateUserById.mockResolvedValueOnce({ error: new Error("db") });
    await expect(record(client([m("otp")]))).resolves.toBeUndefined();
    updateUserById.mockRejectedValueOnce(new Error("boom"));
    await expect(record(client([m("otp")]))).resolves.toBeUndefined();
    await expect(record({})).resolves.toBeUndefined();
    await expect(record(null)).resolves.toBeUndefined();
  });
});

describe("hasCurrentEmailLinkSignIn", () => {
  const AT = "2026-11-01T10:00:00.900Z";
  const base = (over: Record<string, unknown> = {}) => ({
    email: "me@example.com",
    app_metadata: { email_link_signin: { at: AT, email: "me@example.com" } },
    identities: [eid("2026-10-31T00:00:00.000Z")],
    ...over,
  });

  it("is true for a matching marker with an older identity", () => {
    expect(hasCurrentEmailLinkSignIn(base())).toBe(true);
  });

  it("is true when identity updated_at equals the marker second (<=)", () => {
    expect(
      hasCurrentEmailLinkSignIn(
        base({ identities: [eid("2026-11-01T10:00:00.100Z")] }),
      ),
    ).toBe(true);
  });

  it("is false when the identity was updated after the marker", () => {
    expect(
      hasCurrentEmailLinkSignIn(
        base({ identities: [eid("2026-11-01T10:00:01.000Z")] }),
      ),
    ).toBe(false);
  });

  it("is false when the account email no longer matches the marker", () => {
    expect(hasCurrentEmailLinkSignIn(base({ email: "other@example.com" }))).toBe(false);
  });

  it("compares email case-insensitively", () => {
    expect(hasCurrentEmailLinkSignIn(base({ email: "ME@Example.COM" }))).toBe(true);
  });

  it("is false with a missing, malformed or empty marker", () => {
    expect(hasCurrentEmailLinkSignIn(base({ app_metadata: {} }))).toBe(false);
    expect(hasCurrentEmailLinkSignIn(base({ app_metadata: null }))).toBe(false);
    expect(hasCurrentEmailLinkSignIn(base({ app_metadata: { email_link_signin: "x" } }))).toBe(false);
    expect(
      hasCurrentEmailLinkSignIn(base({ app_metadata: { email_link_signin: { at: "nope", email: "me@example.com" } } })),
    ).toBe(false);
  });

  it("is false when an email change was requested after the marker", () => {
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: "2026-11-01T10:00:30.000Z" }))).toBe(false);
  });

  it("is false when the change was requested inside the quiet period before the marker", () => {
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: "2026-11-01T09:00:00.000Z" }))).toBe(false);
  });

  it("H-B4: password change cleared email_change_sent_at; identity change signal still refuses", () => {
    const changed = [eid("2026-11-01T09:59:50.000Z", "2026-10-01T00:00:00.000Z")];
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: null, identities: changed }))).toBe(false);
    const old = [eid("2026-10-31T09:55:00.000Z", "2026-10-01T00:00:00.000Z")];
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: null, identities: old }))).toBe(true);
    const justInside = [eid("2026-10-31T09:55:01.000Z", "2026-10-01T00:00:00.000Z")];
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: null, identities: justInside }))).toBe(false);
  });

  it("is false when the identity has no created_at", () => {
    expect(
      hasCurrentEmailLinkSignIn(
        base({ identities: [{ provider: "email", updated_at: "2026-10-31T00:00:00.000Z" }] }),
      ),
    ).toBe(false);
  });

  it("is true when the change was requested at least 86700 s before the marker", () => {
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: "2026-10-31T09:55:00.000Z" }))).toBe(true);
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: "2026-10-31T09:55:01.000Z" }))).toBe(false);
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: null }))).toBe(true);
  });

  it("fails closed on an unparseable email_change_sent_at", () => {
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: "garbage" }))).toBe(false);
  });

  it("fails closed without an email identity", () => {
    expect(hasCurrentEmailLinkSignIn(base({ identities: [] }))).toBe(false);
    expect(hasCurrentEmailLinkSignIn(base({ identities: undefined }))).toBe(false);
  });
});
