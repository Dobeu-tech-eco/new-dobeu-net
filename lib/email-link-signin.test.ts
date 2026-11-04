import { beforeEach, describe, expect, it, vi } from "vitest";

const updateUserById = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({ auth: { admin: { updateUserById } } })),
}));

import { hasCurrentEmailLinkSignIn, recordEmailLinkSignIn } from "@/lib/email-link-signin";

function client(methods: Array<string | { method: string }>, opts: { aalError?: boolean } = {}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "me@example.com" } } })),
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

beforeEach(() => {
  updateUserById.mockReset();
  updateUserById.mockResolvedValue({ error: null });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("recordEmailLinkSignIn", () => {
  it.each(["otp", "magiclink", "invite", "email/signup"])("writes the marker for %s", async (method) => {
    await recordEmailLinkSignIn(client([{ method }]));
    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(updateUserById).toHaveBeenCalledWith("u1", {
      app_metadata: { email_link_signin: { at: expect.any(String), email: "me@example.com" } },
    });
  });

  it("accepts string-shaped methods", async () => {
    await recordEmailLinkSignIn(client(["magiclink"]));
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it.each([["password"], ["totp"], ["password", "totp"]])("does not write for %s", async (...methods) => {
    await recordEmailLinkSignIn(client(methods.map((method) => ({ method }))));
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("does not write when the assurance lookup errors", async () => {
    await recordEmailLinkSignIn(client([], { aalError: true }));
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("swallows an admin update error, a thrown update and a broken client", async () => {
    updateUserById.mockResolvedValueOnce({ error: new Error("db") });
    await expect(recordEmailLinkSignIn(client(["otp"]))).resolves.toBeUndefined();
    updateUserById.mockRejectedValueOnce(new Error("boom"));
    await expect(recordEmailLinkSignIn(client(["otp"]))).resolves.toBeUndefined();
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

  it("fails closed without an email identity", () => {
    expect(hasCurrentEmailLinkSignIn(base({ identities: [] }))).toBe(false);
    expect(hasCurrentEmailLinkSignIn(base({ identities: undefined }))).toBe(false);
  });
});
