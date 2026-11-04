import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCompanyAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  fromCalls: [] as string[],
  companies: [] as Array<{ id: string; name: string; status: string }>,
  user: { id: "u1" } as { id: string } | null,
  pathname: null as string | null
}));

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => (name === "x-dobeu-pathname" ? h.pathname : null) })
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  }
}));

vi.mock("@/lib/actions/company-auth", () => ({
  COMPANY_ADMIN_RANK: 100,
  requireCompanyAdmin: h.requireCompanyAdmin
}));

vi.mock("@/lib/actions/members", () => ({
  inviteMemberForm: vi.fn(),
  changeMemberRoleForm: vi.fn(),
  deactivateMemberForm: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (table: string) => {
      h.fromCalls.push(table);
      const result =
        table === "company_members"
          ? {
              data: [
                {
                  id: "m1",
                  user_id: "u1",
                  company_id: "c1",
                  role: "company_admin",
                  status: "active",
                  created_at: "2026-01-01T00:00:00Z"
                }
              ]
            }
          : table === "company_roles"
            ? { data: [{ key: "company_admin", label: "Admin", rank: 100 }] }
            : { data: h.companies };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(result)
      };
      return chain;
    }
  }))
}));

import { AuthError } from "@/lib/actions/auth";
import CompanyMembersPage from "./page";

beforeEach(() => {
  h.requireCompanyAdmin.mockReset();
  h.createAdminClient.mockReset();
  h.createAdminClient.mockReturnValue({
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: [{ id: "u1", email: "a@b.co" }] } })
      }
    }
  });
  h.fromCalls.length = 0;
  h.user = { id: "u1" };
  h.pathname = null;
  h.companies = [{ id: "c1", name: "Acme", status: "active" }];
});

afterEach(cleanup);

const props = { searchParams: Promise.resolve({ company: "c1" }) };
const MEMBER_READS = ["company_roles"];

describe("CompanyMembersPage guard", () => {
  it("redirects an AAL1 admin to MFA with the exact encoded deep link; no reads, no admin client", async () => {
    h.requireCompanyAdmin.mockRejectedValue(new AuthError("mfa_required"));
    await expect(CompanyMembersPage(props)).rejects.toMatchObject({
      url: `/portal/settings/mfa?next=${encodeURIComponent("/company/members?company=c1")}`
    });
    expect(h.requireCompanyAdmin).toHaveBeenCalledWith("c1");
    expect(h.createAdminClient).not.toHaveBeenCalled();
    // Only the company-resolution reads happened (one company_roles read).
    expect(h.fromCalls.filter((t) => MEMBER_READS.includes(t))).toHaveLength(1);
  });

  it("renders a notice and never creates the admin client for a suspended company", async () => {
    h.companies = [{ id: "c1", name: "Acme", status: "suspended" }];
    h.requireCompanyAdmin.mockRejectedValue(new AuthError("forbidden"));
    render(await CompanyMembersPage(props));
    expect(screen.getByText(/this company is suspended/i)).toBeInTheDocument();
    expect(screen.getByText(/contact dobeu/i)).toBeInTheDocument();
    expect(h.createAdminClient).not.toHaveBeenCalled();
    expect(h.fromCalls.filter((t) => MEMBER_READS.includes(t))).toHaveLength(1);
  });

  it("shows a neutral (not suspended) notice for forbidden on an active company", async () => {
    h.requireCompanyAdmin.mockRejectedValue(new AuthError("forbidden"));
    render(await CompanyMembersPage(props));
    expect(screen.getByText(/don't have access to this company right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/is suspended/i)).not.toBeInTheDocument();
    expect(h.createAdminClient).not.toHaveBeenCalled();
  });

  it("redirects to login before any query when there is no user", async () => {
    h.user = null;
    await expect(CompanyMembersPage(props)).rejects.toMatchObject({
      url: `/login?next=${encodeURIComponent("/company/members")}`
    });
    expect(h.fromCalls).toEqual([]);
    expect(h.createAdminClient).not.toHaveBeenCalled();
  });

  it("uses the identical validated deep link as the layout when the header is set", async () => {
    h.pathname = "/company/members?company=x&tab=y";
    h.requireCompanyAdmin.mockRejectedValue(new AuthError("mfa_required"));
    await expect(CompanyMembersPage(props)).rejects.toMatchObject({
      url: `/portal/settings/mfa?next=${encodeURIComponent("/company/members?company=x&tab=y")}`
    });
    h.user = null;
    await expect(CompanyMembersPage(props)).rejects.toMatchObject({
      url: `/login?next=${encodeURIComponent("/company/members?company=x&tab=y")}`
    });
  });

  it.each(["/company/../admin", "/company/%2e%2e/admin", "//evil.com", "/portal"])(
    "falls back to the page's own path for hostile header %j",
    async (value) => {
      h.pathname = value;
      h.requireCompanyAdmin.mockRejectedValue(new AuthError("mfa_required"));
      await expect(CompanyMembersPage(props)).rejects.toMatchObject({
        url: `/portal/settings/mfa?next=${encodeURIComponent("/company/members?company=c1")}`
      });
    }
  );

  it("rethrows non-auth errors", async () => {
    h.requireCompanyAdmin.mockRejectedValue(new Error("db down"));
    await expect(CompanyMembersPage(props)).rejects.toThrow("db down");
    expect(h.createAdminClient).not.toHaveBeenCalled();
  });

  it("renders the roster with resolved emails for an AAL2 admin of an active company", async () => {
    h.requireCompanyAdmin.mockResolvedValue({});
    render(await CompanyMembersPage(props));
    expect(screen.getByText("a@b.co")).toBeInTheDocument();
    expect(h.createAdminClient).toHaveBeenCalledTimes(1);
  });
});
