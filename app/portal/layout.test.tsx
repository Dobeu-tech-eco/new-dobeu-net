import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  members: { data: [] as Array<{ company_id: string }> | null, error: null as unknown },
  companies: {
    data: [] as Array<{ id: string; name: string; status: string }> | null,
    error: null as unknown,
  },
}));

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: h.getUser },
    from: (table: string) => {
      const result = table === "company_members" ? h.members : h.companies;
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        neq: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(result),
      };
      return chain;
    },
  })),
}));

vi.mock("@/components/brand/DobeuMark", () => ({ DobeuMark: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/portal/PortalNav", () => ({ PortalNav: () => null }));
vi.mock("@/components/portal/AnalyticsIdentify", () => ({ AnalyticsIdentify: () => null }));

import PortalLayout from "./layout";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  h.getUser.mockReset();
  h.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" } } });
  h.members = { data: [{ company_id: "c1" }], error: null };
  h.companies = { data: [{ id: "c1", name: "Acme", status: "active" }], error: null };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PortalLayout suspended-company banner", () => {
  it("shows the banner and children for a suspended membership", async () => {
    h.companies = { data: [{ id: "c1", name: "Acme", status: "suspended" }], error: null };
    render(await PortalLayout({ children: <p>child</p> }));
    expect(screen.getByRole("status")).toHaveTextContent("Acme is suspended.");
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("omits the banner when every company is active", async () => {
    render(await PortalLayout({ children: <p>child</p> }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("omits the banner but still renders children when a read errors", async () => {
    h.companies = { data: null, error: { message: "rls" } };
    render(await PortalLayout({ children: <p>child</p> }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("still redirects a signed-out user to /login?next=/portal", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    await expect(PortalLayout({ children: <p>child</p> })).rejects.toMatchObject({
      url: "/login?next=/portal",
    });
  });
});
