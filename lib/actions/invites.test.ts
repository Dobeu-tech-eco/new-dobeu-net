import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildStubClient } from "./__test-helpers";

const h = vi.hoisted(() => ({
  client: null as unknown,
  redirect: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  respond: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    h.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/company-invites", async (orig) => ({
  ...(await orig<typeof import("@/lib/company-invites")>()),
  respondToInvite: h.respond,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.client),
  createAdminClient: vi.fn(() => ({ admin: true, auth: { admin: { updateUserById: h.update } } })),
}));
vi.mock("@/lib/admin-audit", () => ({ writeAdminAuditStrict: h.audit }));

import { createAdminClient } from "@/lib/supabase/server";
import {
  acceptCompanyInvite,
  acceptCompanyInviteForm,
  declineCompanyInvite,
  declineCompanyInviteForm,
} from "./invites";

const U = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const fd = new FormData();

function signIn(
  user: Record<string, unknown> | null,
  aal: {
    methods?: ({ method: string; timestamp: number } | string)[];
    error?: boolean;
    signOut?: () => Promise<unknown>;
  } = {},
) {
  const { supabase } = buildStubClient({ user: user as never });
  const methods = aal.methods ?? [{ method: "otp", timestamp: 1 }];
  const signOut = vi.fn(aal.signOut ?? (async () => ({ error: null })));
  const auth = supabase.auth as Record<string, unknown>;
  auth.signOut = signOut;
  auth.getSession = vi.fn(async () => ({ data: { session: { access_token: "tok" } } }));
  auth.mfa = {
    getAuthenticatorAssuranceLevel: vi.fn(async () =>
      aal.error
        ? { data: null, error: { message: "aal down" } }
        : { data: { currentAuthenticationMethods: methods }, error: null },
    ),
  };
  h.client = supabase;
  return { signOut, getAal: (auth.mfa as { getAuthenticatorAssuranceLevel: ReturnType<typeof vi.fn> }).getAuthenticatorAssuranceLevel };
}
const identities = [
  { provider: "email", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
];
const confirmed = {
  id: U,
  email: "a@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  identities,
};

async function redirectOf(p: Promise<void>): Promise<string> {
  await expect(p).rejects.toThrow(/NEXT_REDIRECT/);
  return h.redirect.mock.calls.at(-1)![0] as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  signIn(confirmed);
  h.respond.mockResolvedValue({ ok: true, companyId: C, isAdminRole: false });
  h.update.mockResolvedValue({ error: null });
  h.audit.mockResolvedValue(true);
});

describe("D55 password rotation and D58 audit result", () => {
  it("rotates the password on accept with a random value that is not returned", async () => {
    const r = await acceptCompanyInvite(M);
    expect(h.update).toHaveBeenCalledTimes(1);
    const [id, attrs] = h.update.mock.calls[0];
    expect(id).toBe(U);
    expect(attrs.password).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(r)).not.toContain(attrs.password);
    expect(r).toEqual({ ok: true, data: { companyId: C, isAdminRole: false } });
    expect(h.audit.mock.calls[0][1].action).toBe("company_member.password_rotated");
  });

  it("uses a fresh password each time", async () => {
    await acceptCompanyInvite(M);
    await acceptCompanyInvite(M);
    expect(h.update.mock.calls[0][1].password).not.toBe(h.update.mock.calls[1][1].password);
  });

  it("does not rotate on decline", async () => {
    await declineCompanyInvite(M);
    expect(h.update).not.toHaveBeenCalled();
  });

  it.each([
    ["returned error", () => h.update.mockResolvedValue({ error: { message: "secret" } })],
    ["throw", () => h.update.mockRejectedValue(new Error("secret"))],
  ])("a rotation %s is flagged, audited and does not undo the accept", async (_n, arrange) => {
    arrange();
    const warn = vi.spyOn(console, "warn");
    const r = await acceptCompanyInvite(M);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
    expect(r).toEqual({
      ok: true,
      data: { companyId: C, isAdminRole: false, passwordRotationFailed: true },
    });
    expect(h.audit.mock.calls[0][1].action).toBe("company_member.password_rotation_failed");
  });

  it("surfaces auditFailed from the core without failing", async () => {
    h.respond.mockResolvedValue({ ok: true, companyId: C, isAdminRole: false, auditFailed: true });
    expect(await declineCompanyInvite(M)).toEqual({
      ok: true,
      data: { companyId: C, isAdminRole: false, auditFailed: true },
    });
  });

  it("flags passwordAuditFailed (not auditFailed) when the rotation audit cannot be written", async () => {
    h.audit.mockResolvedValue(false);
    expect(await acceptCompanyInvite(M)).toEqual({
      ok: true,
      data: { companyId: C, isAdminRole: false, passwordAuditFailed: true },
    });
  });

  it("does not rotate for a refused accept", async () => {
    h.respond.mockResolvedValue({ ok: false, error: "invite_company_inactive" });
    expect(await acceptCompanyInvite(M)).toEqual({ ok: false, error: "invite_company_inactive" });
    expect(h.update).not.toHaveBeenCalled();
  });

  it("does not rotate for a bad member id", async () => {
    expect(await acceptCompanyInvite("not-a-uuid")).toEqual({ ok: false, error: "invite_unavailable" });
    expect(h.update).not.toHaveBeenCalled();
  });
});

describe("acceptCompanyInvite / declineCompanyInvite", () => {
  it("passes the verified user id, validated member id and response to the core", async () => {
    expect(await acceptCompanyInvite(M)).toEqual({
      ok: true,
      data: { companyId: C, isAdminRole: false },
    });
    const proofArg = { methods: [{ method: "otp", timestamp: 1 }], identities, emailChangeSentAt: null };
    expect(h.respond).toHaveBeenCalledWith(expect.objectContaining({ admin: true }), U, M, "accept", proofArg);
    await declineCompanyInvite(M);
    expect(h.respond).toHaveBeenLastCalledWith(expect.objectContaining({ admin: true }), U, M, "decline", proofArg);
    expect(h.revalidate).toHaveBeenCalledWith("/portal");
    expect(h.revalidate).toHaveBeenCalledWith("/company");
  });

  it("reads the session methods with the session's access token", async () => {
    const { getAal } = signIn(confirmed);
    await acceptCompanyInvite(M);
    expect(getAal).toHaveBeenCalledWith("tok");
  });

  it("not authenticated: no admin client, no core call", async () => {
    signIn(null);
    expect(await acceptCompanyInvite(M)).toEqual({ ok: false, error: "not_authenticated" });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(h.respond).not.toHaveBeenCalled();
  });

  it.each([
    ["accept", acceptCompanyInvite],
    ["decline", declineCompanyInvite],
  ])("unconfirmed email: %s never creates the admin client", async (_n, fn) => {
    signIn({ id: U, email: "a@example.com", email_confirmed_at: null });
    expect(await fn(M)).toEqual({ ok: false, error: "invite_email_unconfirmed" });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(h.respond).not.toHaveBeenCalled();
  });

  it.each([
    ["accept", acceptCompanyInvite],
    ["decline", declineCompanyInvite],
  ])("%s hands the session methods and identities to the core, which decides", async (_n, fn) => {
    h.respond.mockResolvedValue({ ok: false, error: "invite_email_unconfirmed" });
    signIn(confirmed, { methods: [{ method: "password", timestamp: 5 }, { method: "totp", timestamp: 6 }] });
    expect(await fn(M)).toEqual({ ok: false, error: "invite_email_unconfirmed" });
    expect(h.respond.mock.calls.at(-1)![4]).toEqual({
      methods: [{ method: "password", timestamp: 5 }, { method: "totp", timestamp: 6 }],
      identities,
      emailChangeSentAt: null,
    });
  });

  it("hands the user's email_change_sent_at to the core", async () => {
    signIn({ ...confirmed, email_change_sent_at: "2026-01-02T00:00:00Z" });
    await acceptCompanyInvite(M);
    expect(h.respond.mock.calls.at(-1)![4]).toMatchObject({
      emailChangeSentAt: "2026-01-02T00:00:00Z",
    });
  });

  it.each([
    ["accept", acceptCompanyInvite],
    ["decline", declineCompanyInvite],
  ])("%s with an expired or stale sign-in is refused with that code", async (_n, fn) => {
    h.respond.mockResolvedValue({ ok: false, error: "invite_signin_stale" });
    expect(await fn(M)).toEqual({ ok: false, error: "invite_signin_stale" });
    expect(h.revalidate).not.toHaveBeenCalled();
  });

  it("a lookup error is invite_response_failed and creates no admin client", async () => {
    signIn(confirmed, { error: true });
    expect(await acceptCompanyInvite(M)).toEqual({ ok: false, error: "invite_response_failed" });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(h.respond).not.toHaveBeenCalled();
  });

  it("a successful accept revokes the user's other sessions", async () => {
    const { signOut } = signIn(confirmed);
    expect((await acceptCompanyInvite(M)).ok).toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("a failed accept, any decline and a refused session never revoke sessions", async () => {
    const { signOut } = signIn(confirmed);
    h.respond.mockResolvedValue({ ok: false, error: "invite_company_inactive" });
    await acceptCompanyInvite(M);
    h.respond.mockResolvedValue({ ok: true, companyId: C, isAdminRole: false });
    await declineCompanyInvite(M);
    await acceptCompanyInvite("not-a-uuid");
    expect(signOut).not.toHaveBeenCalled();
  });

  it.each([
    ["returns an error", async () => ({ error: { message: "raw gotrue text" } })],
    ["throws", async () => { throw new Error("raw gotrue text"); }],
  ])("a signOut that %s is non-fatal and logs no raw text", async (_n, signOut) => {
    signIn(confirmed, { signOut });
    const warn = vi.spyOn(console, "warn");
    expect(await acceptCompanyInvite(M)).toEqual({
      ok: true,
      data: { companyId: C, isAdminRole: false },
    });
    expect(h.revalidate).toHaveBeenCalledWith("/portal");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("raw gotrue text");
  });

  it("carries companyInactive through to the data", async () => {
    h.respond.mockResolvedValue({ ok: true, companyId: C, isAdminRole: true, companyInactive: true });
    expect(await acceptCompanyInvite(M)).toEqual({
      ok: true,
      data: { companyId: C, isAdminRole: true, companyInactive: true },
    });
  });

  it("a malformed member id makes no database call", async () => {
    expect(await acceptCompanyInvite("not-a-uuid")).toEqual({
      ok: false,
      error: "invite_unavailable",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(h.respond).not.toHaveBeenCalled();
  });

  it("passes the core's failure code through", async () => {
    h.respond.mockResolvedValue({ ok: false, error: "invite_unavailable" });
    expect(await acceptCompanyInvite(M)).toEqual({ ok: false, error: "invite_unavailable" });
    expect(h.revalidate).not.toHaveBeenCalled();
  });

  it("an unexpected throw becomes invite_response_failed", async () => {
    h.respond.mockRejectedValue(new Error("raw supabase text"));
    const r = await declineCompanyInvite(M);
    expect(r).toEqual({ ok: false, error: "invite_response_failed" });
  });
});

describe("form wrappers", () => {
  it("accept as a non-admin goes to /portal with the accepted notice", async () => {
    expect(await redirectOf(acceptCompanyInviteForm(M, fd))).toBe(
      "/portal?notice=invite_accepted",
    );
  });

  it("accept as an admin goes to that company's dashboard", async () => {
    h.respond.mockResolvedValue({ ok: true, companyId: C, isAdminRole: true });
    expect(await redirectOf(acceptCompanyInviteForm(M, fd))).toBe(`/company?company=${C}`);
  });

  it.each([true, false])(
    "accept into a suspended company (admin=%s) goes to /portal, never /company",
    async (isAdminRole) => {
      h.respond.mockResolvedValue({ ok: true, companyId: C, isAdminRole, companyInactive: true });
      expect(await redirectOf(acceptCompanyInviteForm(M, fd))).toBe(
        "/portal?notice=invite_accepted_company_inactive",
      );
    },
  );

  it("decline goes to /portal with the declined notice", async () => {
    expect(await redirectOf(declineCompanyInviteForm(M, fd))).toBe(
      "/portal?notice=invite_declined",
    );
  });

  it.each([
    "invite_unavailable",
    "invite_email_unconfirmed",
    "invite_signin_stale",
    "invite_email_changed",
    "invite_company_inactive",
    "invite_already_accepted",
    "invite_response_failed",
  ])("failure %s redirects with that fixed code", async (code) => {
    h.respond.mockResolvedValue({ ok: false, error: code });
    expect(await redirectOf(acceptCompanyInviteForm(M, fd))).toBe(`/portal?notice=${code}`);
    expect(await redirectOf(declineCompanyInviteForm(M, fd))).toBe(`/portal?notice=${code}`);
  });

  it("an unknown failure code collapses to invite_response_failed", async () => {
    h.respond.mockResolvedValue({ ok: false, error: "raw supabase text" });
    expect(await redirectOf(acceptCompanyInviteForm(M, fd))).toBe(
      "/portal?notice=invite_response_failed",
    );
  });

  it("an unconfirmed email redirects with the unconfirmed code", async () => {
    signIn({ id: U, email: "a@example.com", email_confirmed_at: null });
    expect(await redirectOf(acceptCompanyInviteForm(M, fd))).toBe(
      "/portal?notice=invite_email_unconfirmed",
    );
  });

  it("not authenticated goes to login with no notice", async () => {
    signIn(null);
    expect(await redirectOf(acceptCompanyInviteForm(M, fd))).toBe("/login?next=/portal");
    expect(await redirectOf(declineCompanyInviteForm(M, fd))).toBe("/login?next=/portal");
  });
});
