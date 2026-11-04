import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCompanyAdmin: vi.fn(),
  fromCalls: [] as string[],
  companies: [] as Array<{ id: string; name: string; status: string }>,
  user: { id: "u1" } as { id: string } | null
}));

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  }
}));

vi.mock("@/lib/actions/company-auth", () => ({
  COMPANY_ADMIN_RANK: 100,
  requireCompanyAdmin: h.requireCompanyAdmin
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (table: string) => {
      h.fromCalls.push(table);
      const result =
        table === "company_members"
          ? { data: [{ company_id: "c1", role: "company_admin" }] }
          : table === "company_roles"
            ? { data: [{ key: "company_admin", rank: 100 }] }
            : table === "companies"
              ? { data: h.companies }
              : { count: 3 };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(result)
      };
      return chain;
    }
  }))
}));

import { AuthError } from "@/lib/actions/auth";
import CompanyOverviewPage from "./page";

const DATA_TABLES = ["projects", "work_orders", "asset_entitlements"];

beforeEach(() => {
  h.requireCompanyAdmin.mockReset();
  h.fromCalls.length = 0;
  h.user = { id: "u1" };
  h.companies = [{ id: "c1", name: "Acme", status: "active" }];
});

afterEach(cleanup);

const props = { searchParams: Promise.resolve({ company: "c1" }) };

describe("CompanyOverviewPage guard", () => {
  it("redirects an AAL1 admin to MFA with the exact encoded deep link and reads no data", async () => {
    h.requireCompanyAdmin.mockRejectedValue(new AuthError("mfa_required"));
    await expect(CompanyOverviewPage(props)).rejects.toMatchObject({
      url: `/portal/settings/mfa?next=${encodeURIComponent("/company?company=c1")}`
    });
    expect(h.requireCompanyAdmin).toHaveBeenCalledWith("c1");
    expect(h.fromCalls.filter((t) => DATA_TABLES.includes(t))).toEqual([]);
  });

  it("renders a notice and reads no data for a suspended company", async () => {
    h.companies = [{ id: "c1", name: "Acme", status: "suspended" }];
    h.requireCompanyAdmin.mockRejectedValue(new AuthError("forbidden"));
    render(await CompanyOverviewPage(props));
    expect(screen.getByText(/this company is suspended/i)).toBeInTheDocument();
    expect(screen.getByText(/contact dobeu/i)).toBeInTheDocument();
    expect(h.fromCalls.filter((t) => DATA_TABLES.includes(t))).toEqual([]);
  });

  it("shows a neutral (not suspended) notice for forbidden on an active company and reads no data", async () => {
    h.requireCompanyAdmin.mockRejectedValue(new AuthError("forbidden"));
    render(await CompanyOverviewPage(props));
    expect(screen.getByText(/don't have access to this company right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/is suspended/i)).not.toBeInTheDocument();
    expect(h.fromCalls.filter((t) => DATA_TABLES.includes(t))).toEqual([]);
  });

  it("redirects to login before any query when there is no user", async () => {
    h.user = null;
    await expect(CompanyOverviewPage(props)).rejects.toMatchObject({
      url: `/login?next=${encodeURIComponent("/company")}`
    });
    expect(h.fromCalls).toEqual([]);
    expect(h.requireCompanyAdmin).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated guard failure to login with the deep link", async () => {
    h.requireCompanyAdmin.mockRejectedValue(new AuthError("not_authenticated"));
    await expect(CompanyOverviewPage(props)).rejects.toMatchObject({
      url: `/login?next=${encodeURIComponent("/company?company=c1")}`
    });
  });

  it("rethrows non-auth errors", async () => {
    h.requireCompanyAdmin.mockRejectedValue(new Error("db down"));
    await expect(CompanyOverviewPage(props)).rejects.toThrow("db down");
  });

  it("renders the overview for an AAL2 admin of an active company", async () => {
    h.requireCompanyAdmin.mockResolvedValue({});
    render(await CompanyOverviewPage(props));
    expect(screen.getByRole("heading", { name: "Acme" })).toBeInTheDocument();
    expect(h.fromCalls).toEqual(expect.arrayContaining(DATA_TABLES));
  });
});
