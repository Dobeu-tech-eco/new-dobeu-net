import { beforeEach, describe, expect, it, vi } from "vitest";

const updateUserById = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ auth: { admin: { updateUserById } } })),
}));

import { hasCurrentEmailLinkSignIn, recordEmailLinkSignIn } from "@/lib/email-link-signin";

// Link requested at SENT, session created (amr timestamp) at LINK_TS.
const SENT = "2026-11-01T10:00:00.000Z";
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
    recovery_sent_at: SENT,
    confirmation_sent_at: null,
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

  it("H-B race: link requested, then email change requested and confirmed, then code exchanged: no marker", async () => {
    await recordEmailLinkSignIn(
      client([m("magiclink")], {
        user: {
          email: "attacker@example.com",
          email_change_sent_at: "2026-11-01T10:00:02.000Z",
          identities: [{ provider: "email", updated_at: "2026-11-01T10:00:04.000Z" }],
        },
      }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("marker skipped"));
  });

  it("an email change requested after the link was sent skips the marker even while the identity is untouched", async () => {
    await recordEmailLinkSignIn(
      client([m("magiclink")], { user: { email_change_sent_at: "2026-11-01T10:00:02.000Z" } }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("an email change confirmed after the link was sent skips the marker even without email_change_sent_at", async () => {
    await recordEmailLinkSignIn(
      client([m("magiclink")], {
        user: { identities: [{ provider: "email", updated_at: "2026-11-01T10:00:03.000Z" }] },
      }),
    );
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("a legitimate magic link after an old email change writes the marker", async () => {
    await recordEmailLinkSignIn(
      client([m("magiclink")], {
        user: {
          email_change_sent_at: "2026-10-20T00:00:00.000Z",
          identities: [{ provider: "email", updated_at: "2026-10-20T00:05:00.000Z" }],
        },
      }),
    );
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it("a first-time unconfirmed invitee (confirmation_sent_at) writes the marker", async () => {
    await recordEmailLinkSignIn(
      client([m("email/signup")], {
        user: {
          recovery_sent_at: null,
          confirmation_sent_at: SENT,
          identities: [{ provider: "email", updated_at: "2026-11-01T10:00:01.000Z" }],
        },
      }),
    );
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it("skips when no link-sent timestamp exists or the identity is missing", async () => {
    await recordEmailLinkSignIn(
      client([m("otp")], { user: { recovery_sent_at: null, confirmation_sent_at: null } }),
    );
    await recordEmailLinkSignIn(client([m("otp")], { user: { identities: [] } }));
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

  it("is true when the email change was requested before the marker", () => {
    expect(hasCurrentEmailLinkSignIn(base({ email_change_sent_at: "2026-11-01T09:00:00.000Z" }))).toBe(true);
  });

  it("fails closed without an email identity", () => {
    expect(hasCurrentEmailLinkSignIn(base({ identities: [] }))).toBe(false);
    expect(hasCurrentEmailLinkSignIn(base({ identities: undefined }))).toBe(false);
  });
});
