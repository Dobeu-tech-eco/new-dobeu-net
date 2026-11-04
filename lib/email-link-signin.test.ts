import { beforeEach, describe, expect, it, vi } from "vitest";

const updateUserById = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ auth: { admin: { updateUserById } } })),
}));

import { hasCurrentEmailLinkSignIn, recordEmailLinkSignIn } from "@/lib/email-link-signin";

// Session created (amr timestamp) at LINK_TS.
const LINK_TS = Math.floor(Date.parse("2026-11-01T10:00:05.000Z") / 1000);

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
    identities: [{ provider: "email", updated_at: "2026-10-01T00:00:00.000Z" }],
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
const m = (method: string) => ({ method, timestamp: LINK_TS });

beforeEach(() => {
  updateUserById.mockReset();
  updateUserById.mockResolvedValue({ error: null });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("recordEmailLinkSignIn", () => {
  it.each(["otp", "magiclink", "invite", "email/signup"])("writes the marker for %s, stamped with the amr timestamp", async (method) => {
    await recordEmailLinkSignIn(client([m(method)]));
    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(updateUserById).toHaveBeenCalledWith("u1", {
      app_metadata: {
        email_link_signin: { at: "2026-11-01T10:00:05.000Z", email: "me@example.com" },
      },
    });
  });

  it("uses the newest link entry's timestamp, not the wall clock", async () => {
    await recordEmailLinkSignIn(
      client([{ method: "otp", timestamp: LINK_TS - 100 }, m("magiclink"), { method: "password", timestamp: LINK_TS + 50 }]),
    );
    const at = updateUserById.mock.calls[0][1].app_metadata.email_link_signin.at;
    expect(at).toBe("2026-11-01T10:00:05.000Z");
  });

  it("fails closed for string-shaped or timestamp-less entries", async () => {
    await recordEmailLinkSignIn(client(["magiclink", { method: "otp" }]));
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it.each([["password"], ["totp"], ["password", "totp"]])("does not write for %s", async (...methods) => {
    await recordEmailLinkSignIn(client(methods.map(m)));
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("does not write when the assurance lookup errors", async () => {
    await recordEmailLinkSignIn(client([], { aalError: true }));
    expect(updateUserById).not.toHaveBeenCalled();
  });

  const iso = (secs: number) => new Date(secs * 1000).toISOString();

  it("H-B3: change requested 5 s before the link, identity updated 1 s before: no marker", async () => {
    await recordEmailLinkSignIn(
      client([m("magiclink")], {
        user: {
          email: "victim@example.com",
          email_change_sent_at: iso(LINK_TS - 5),
          identities: [{ provider: "email", updated_at: iso(LINK_TS - 1) }],
        },
      }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("marker skipped"));
  });

  it("a change requested 2 h before the link (inside the quiet period) skips the marker", async () => {
    await recordEmailLinkSignIn(
      client([m("magiclink")], { user: { email_change_sent_at: iso(LINK_TS - 7_200) } }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("an identity confirmed after the sign-in skips the marker even without email_change_sent_at", async () => {
    await recordEmailLinkSignIn(
      client([m("magiclink")], {
        user: { identities: [{ provider: "email", updated_at: iso(LINK_TS + 1) }] },
      }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("a change 25 h before and exactly 86400 s before the link write the marker; 86399 s does not", async () => {
    for (const secs of [25 * 3_600, 86_400]) {
      updateUserById.mockClear();
      await recordEmailLinkSignIn(
        client([m("magiclink")], {
          user: {
            email_change_sent_at: iso(LINK_TS - secs),
            identities: [{ provider: "email", updated_at: iso(LINK_TS - secs + 300) }],
          },
        }),
      );
      expect(updateUserById).toHaveBeenCalledTimes(1);
    }
    updateUserById.mockClear();
    await recordEmailLinkSignIn(
      client([m("magiclink")], { user: { email_change_sent_at: iso(LINK_TS - 86_399) } }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("a first-time confirmed invitee (identity created before the link) writes the marker", async () => {
    await recordEmailLinkSignIn(
      client([m("email/signup")], {
        user: { identities: [{ provider: "email", updated_at: iso(LINK_TS - 4) }] },
      }),
    );
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it("fails closed on an unparseable email_change_sent_at, a missing identity or an unparseable updated_at", async () => {
    await recordEmailLinkSignIn(client([m("otp")], { user: { email_change_sent_at: "garbage" } }));
    await recordEmailLinkSignIn(client([m("otp")], { user: { identities: [] } }));
    await recordEmailLinkSignIn(
      client([m("otp")], { user: { identities: [{ provider: "email", updated_at: "nope" }] } }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("swallows an admin update error, a thrown update and a broken client", async () => {
    updateUserById.mockResolvedValueOnce({ error: new Error("db") });
    await expect(recordEmailLinkSignIn(client([m("otp")]))).resolves.toBeUndefined();
    updateUserById.mockRejectedValueOnce(new Error("boom"));
    await expect(recordEmailLinkSignIn(client([m("otp")]))).resolves.toBeUndefined();
    await expect(recordEmailLinkSignIn({})).resolves.toBeUndefined();
    await expect(recordEmailLinkSignIn(null)).resolves.toBeUndefined();
  });
});

describe("hasCurrentEmailLinkSignIn", () => {
  const AT = "2026-11-01T10:00:00.900Z";
  const base = (over: Record<string, unknown> = {}) => ({
    email: "me@example.com",
    app_metadata: { email_link_signin: { at: AT, email: "me@example.com" } },
    identities: [{ provider: "email", updated_at: "2026-10-31T00:00:00.000Z" }],
    ...over,
  });

  it("is true for a matching marker with an older identity", () => {
    expect(hasCurrentEmailLinkSignIn(base())).toBe(true);
  });

  it("is true when identity updated_at equals the marker second (<=)", () => {
    expect(
      hasCurrentEmailLinkSignIn(
        base({ identities: [{ provider: "email", updated_at: "2026-11-01T10:00:00.100Z" }] }),
      ),
    ).toBe(true);
  });

  it("is false when the identity was updated after the marker", () => {
    expect(
      hasCurrentEmailLinkSignIn(
        base({ identities: [{ provider: "email", updated_at: "2026-11-01T10:00:01.000Z" }] }),
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

  it("is true when the change was requested at least 86400 s before the marker", () => {
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: "2026-10-31T10:00:00.000Z" }))).toBe(true);
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: "2026-10-31T10:00:01.000Z" }))).toBe(false);
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
