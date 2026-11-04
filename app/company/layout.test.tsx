import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAal: vi.fn(),
  members: [] as Array<{ company_id: string; role: string }>,
  membersError: null as unknown,
  pathname: null as string | null,
  companies: { data: [] as Array<{ id: string; name?: string; status: string }> | null, error: null as unknown },
}));

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => (name === "x-dobeu-pathname" ? h.pathname : null) }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: h.getUser,
      mfa: { getAuthenticatorAssuranceLevel: h.getAal },
    },
    from: (table: string) => {
      const result =
        table === "company_members"
          ? { data: h.members, error: h.membersError }
          : table === "companies"
            ? h.companies
            : { data: [{ key: "company_admin", rank: 100 }, { key: "member", rank: 10 }] };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(result),
      };
      return chain;
    },
  })),
}));

vi.mock("@/components/brand/DobeuMark", () => ({ DobeuMark: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/portal/LogoutButton", () => ({ LogoutButton: () => null }));

import CompanyLayout from "./layout";

beforeEach(() => {
  h.getUser.mockReset();
  h.getAal.mockReset();
  h.pathname = null;
  h.members = [{ company_id: "c1", role: "company_admin" }];
  h.membersError = null;
  h.companies = { data: [{ id: "c1", status: "active" }], error: null };
  h.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" } } });
});

afterEach(cleanup);

async function redirectTarget(): Promise<string> {
  try {
    await CompanyLayout({ children: <p>child</p> });
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
  throw new Error("expected a redirect");
}

const MFA = "/portal/settings/mfa?next=%2Fcompany";

describe("CompanyLayout", () => {
  it("redirects a signed-out user to /login?next=%2Fcompany", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    expect(await redirectTarget()).toBe("/login?next=%2Fcompany");
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("keeps the encoded deep link in the signed-out backstop", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    h.pathname = "/company/members?company=x";
    expect(await redirectTarget()).toBe("/login?next=%2Fcompany%2Fmembers%3Fcompany%3Dx");
  });

  it("keeps the requested deep link through the MFA step-up", async () => {
    h.getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    h.pathname = "/company/members?company=x";
    expect(await redirectTarget()).toBe("/portal/settings/mfa?next=%2Fcompany%2Fmembers%3Fcompany%3Dx");
  });

  it.each(["/company/../admin", "/company/%2e%2e/admin", "/company/foo/../../portal", "/company/./members", "/company/%2E%2e/x"])(
    "rejects dot-segment header %j",
    async (value) => {
      h.getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
      h.pathname = value;
      expect(await redirectTarget()).toBe(MFA);
    },
  );

  it.each(["//evil.com", "/portal", "https://x.example", "/company/\u0001x", "/company\tx", "/companyfoo"])(
    "falls back to /company for hostile header %j",
    async (value) => {
      h.getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
      h.pathname = value;
      expect(await redirectTarget()).toBe(MFA);
    },
  );

  it("sends a non-admin member to /portal before any AAL lookup", async () => {
    h.members = [{ company_id: "c1", role: "member" }];
    expect(await redirectTarget()).toBe("/portal");
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("shows a suspended notice (no shell, no AAL lookup) when every admin company is suspended", async () => {
    h.companies = { data: [{ id: "c1", status: "suspended" }], error: null };
    render(await CompanyLayout({ children: <p>child</p> }));
    expect(screen.getByText(/this company is suspended/i)).toBeInTheDocument();
    expect(screen.queryByText("child")).not.toBeInTheDocument();
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("still renders the shell when at least one admin company is active", async () => {
    h.members = [
      { company_id: "c1", role: "company_admin" },
      { company_id: "c2", role: "company_admin" },
    ];
    h.companies = {
      data: [
        { id: "c1", status: "suspended" },
        { id: "c2", status: "active" },
      ],
      error: null,
    };
    h.getAal.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    render(await CompanyLayout({ children: <p>child</p> }));
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("fails closed to /portal when the companies read errors", async () => {
    h.companies = { data: null, error: { message: "rls" } };
    expect(await redirectTarget()).toBe("/portal");
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("fails closed to /portal when the memberships read errors", async () => {
    h.membersError = { message: "rls" };
    expect(await redirectTarget()).toBe("/portal");
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("sends an AAL1 admin with a factor to MFA step-up", async () => {
    h.getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    expect(await redirectTarget()).toBe(MFA);
  });

  it("sends an unenrolled admin to MFA", async () => {
    h.getAal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
    expect(await redirectTarget()).toBe(MFA);
  });

  it("fails closed when the AAL lookup returns an error", async () => {
    h.getAal.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await redirectTarget()).toBe(MFA);
  });

  it("fails closed when the AAL lookup throws", async () => {
    h.getAal.mockRejectedValue(new Error("network"));
    expect(await redirectTarget()).toBe(MFA);
  });

  it("renders children for an AAL2 admin", async () => {
    h.getAal.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    render(await CompanyLayout({ children: <p>child</p> }));
    expect(screen.getByText("child")).toBeInTheDocument();
  });
});
