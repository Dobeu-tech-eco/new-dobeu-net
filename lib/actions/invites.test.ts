import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildStubClient } from "./__test-helpers";

const h = vi.hoisted(() => ({
  client: null as unknown,
  redirect: vi.fn(),
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
  createAdminClient: vi.fn(() => ({ admin: true })),
}));

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
  aal: { methods?: string[]; error?: boolean } = {},
) {
  const { supabase } = buildStubClient({ user: user as never });
  const methods = (aal.methods ?? ["otp"]).map((method) => ({ method, timestamp: 1 }));
  (supabase.auth as Record<string, unknown>).mfa = {
    getAuthenticatorAssuranceLevel: vi.fn(async () =>
      aal.error
        ? { data: null, error: { message: "aal down" } }
        : { data: { currentAuthenticationMethods: methods }, error: null },
    ),
  };
  h.client = supabase;
}
const confirmed = { id: U, email: "a@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" };

async function redirectOf(p: Promise<void>): Promise<string> {
  await expect(p).rejects.toThrow(/NEXT_REDIRECT/);
  return h.redirect.mock.calls.at(-1)![0] as string;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  signIn(confirmed);
  h.respond.mockResolvedValue({ ok: true, companyId: C, isAdminRole: false });
});

describe("acceptCompanyInvite / declineCompanyInvite", () => {
  it("passes the verified user id, validated member id and response to the core", async () => {
    expect(await acceptCompanyInvite(M)).toEqual({
      ok: true,
      data: { companyId: C, isAdminRole: false },
    });
    expect(h.respond).toHaveBeenCalledWith({ admin: true }, U, M, "accept");
    await declineCompanyInvite(M);
    expect(h.respond).toHaveBeenLastCalledWith({ admin: true }, U, M, "decline");
    expect(h.revalidate).toHaveBeenCalledWith("/portal");
    expect(h.revalidate).toHaveBeenCalledWith("/company");
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
  ])("%s with a password-only (or password + totp) session is refused", async (_n, fn) => {
    signIn(confirmed, { methods: ["password"] });
    expect(await fn(M)).toEqual({ ok: false, error: "invite_email_unconfirmed" });
    signIn(confirmed, { methods: ["password", "totp"] });
    expect(await fn(M)).toEqual({ ok: false, error: "invite_email_unconfirmed" });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(h.respond).not.toHaveBeenCalled();
  });

  it.each(["otp", "magiclink", "invite", "email/signup"])(
    "a %s session proves the mailbox",
    async (method) => {
      signIn(confirmed, { methods: ["password", method] });
      expect((await acceptCompanyInvite(M)).ok).toBe(true);
    },
  );

  it("a lookup error is invite_response_failed and creates no admin client", async () => {
    signIn(confirmed, { error: true });
    expect(await acceptCompanyInvite(M)).toEqual({ ok: false, error: "invite_response_failed" });
    expect(createAdminClient).not.toHaveBeenCalled();
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

  it("decline goes to /portal with the declined notice", async () => {
    expect(await redirectOf(declineCompanyInviteForm(M, fd))).toBe(
      "/portal?notice=invite_declined",
    );
  });

  it("failures redirect with one fixed code", async () => {
    h.respond.mockResolvedValue({ ok: false, error: "invite_unavailable" });
    expect(await redirectOf(acceptCompanyInviteForm(M, fd))).toBe(
      "/portal?notice=invite_unavailable",
    );
    h.respond.mockResolvedValue({ ok: false, error: "invite_response_failed" });
    expect(await redirectOf(declineCompanyInviteForm(M, fd))).toBe(
      "/portal?notice=invite_response_failed",
    );
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
