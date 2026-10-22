import { Children, isValidElement, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";

const h = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createCompany: vi.fn(),
  suspendCompany: vi.fn(),
  reactivateCompany: vi.fn(),
  provisionCompanyAdmin: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("@/lib/actions/companies", () => ({
  createCompany: h.createCompany,
  suspendCompany: h.suspendCompany,
  reactivateCompany: h.reactivateCompany,
  provisionCompanyAdmin: h.provisionCompanyAdmin,
}));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));

import AdminCompaniesPage from "./page";

const companies = [
  {
    id: "active-company",
    name: "Active company",
    status: "active",
    created_at: "2026-10-20T12:00:00Z",
  },
  {
    id: "suspended-company",
    name: "Suspended company",
    status: "suspended",
    created_at: "2026-10-20T12:00:00Z",
  },
];

function stubQuery(errorTable?: string) {
  h.createAdminClient.mockReturnValue(
    buildStubClient({
      tables: {
        companies: {
          selectSingle: {
            data: companies,
            error:
              errorTable === "companies"
                ? { message: "private database details" }
                : null,
          },
        },
        company_members: {
          selectSingle: {
            data: [],
            error:
              errorTable === "company_members"
                ? { message: "private database details" }
                : null,
          },
        },
      },
    }).supabase,
  );
}

function formActions(
  node: ReactNode,
): Array<(data: FormData) => Promise<void>> {
  return Children.toArray(node).flatMap((child) => {
    if (
      !isValidElement<{
        action?: (data: FormData) => Promise<void>;
        children?: ReactNode;
      }>(child)
    )
      return [];
    return [
      ...(child.type === "form" && child.props.action
        ? [child.props.action]
        : []),
      ...formActions(child.props.children),
    ];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubQuery();
  for (const action of [
    h.createCompany,
    h.suspendCompany,
    h.reactivateCompany,
    h.provisionCompanyAdmin,
  ]) {
    action.mockResolvedValue({ ok: true, data: {} });
  }
});
afterEach(cleanup);

describe("company action feedback", () => {
  it.each([
    "<script>alert(1)</script>",
    "https://evil.example/re-authenticate",
    "x".repeat(500),
    "toString",
    "__proto__",
  ])(
    "replaces unrecognized query error %s with generic copy",
    async (error) => {
      const { container } = render(
        await AdminCompaniesPage({ searchParams: Promise.resolve({ error }) }),
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something went wrong. Try again.",
      );
      expect(container.textContent).not.toContain(error);
    },
  );
  it("renders action errors as alerts", async () => {
    render(
      await AdminCompaniesPage({
        searchParams: Promise.resolve({
          error: "company_suspend_failed",
        }),
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to suspend the company. Try again.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders successful action feedback as a status", async () => {
    render(
      await AdminCompaniesPage({ searchParams: Promise.resolve({ ok: "1" }) }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Company updated successfully.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("prioritizes an error over a stale success flag", async () => {
    render(
      await AdminCompaniesPage({
        searchParams: Promise.resolve({
          ok: "1",
          error: "admin_provision_failed",
        }),
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to provision the company admin. Try again.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["companies", "company_members"])(
    "surfaces a %s read failure without database details",
    async (table) => {
      stubQuery(table);
      render(
        await AdminCompaniesPage({
          searchParams: Promise.resolve({ error: "company_create_failed" }),
        }),
      );
      expect(
        screen.getByText(
          "Unable to load companies and member counts. Try again.",
        ),
      ).toHaveAttribute("role", "alert");
      expect(screen.getAllByRole("alert")).toHaveLength(2);
      expect(screen.queryByText(/private database/)).not.toBeInTheDocument();
    },
  );

  const wrappers = [
    {
      name: "create",
      code: "company_create_failed",
      index: 0,
      action: h.createCompany,
      expected: { name: "Acme" },
    },
    {
      name: "suspend",
      code: "company_suspend_failed",
      index: 1,
      action: h.suspendCompany,
      expected: { id: "active-company" },
    },
    {
      name: "provision",
      code: "admin_provision_failed",
      index: 2,
      action: h.provisionCompanyAdmin,
      expected: { companyId: "active-company", email: "admin@example.com" },
    },
    {
      name: "reactivate",
      code: "company_reactivate_failed",
      index: 3,
      action: h.reactivateCompany,
      expected: { id: "active-company" },
    },
  ];

  it.each(wrappers)(
    "redirects $name failures with fixed error codes, excluding provider text",
    async ({ index, action, expected, code }) => {
      action.mockResolvedValue({
        ok: false,
        error: "Cannot invite: suspended & inactive?",
      });
      const tree = await AdminCompaniesPage({
        searchParams: Promise.resolve({}),
      });
      const data = new FormData();
      data.set("name", "Acme");
      data.set("id", "active-company");
      data.set("companyId", "active-company");
      data.set("email", "admin@example.com");

      await expect(formActions(tree)[index](data)).rejects.toThrow("REDIRECT:");
      expect(action).toHaveBeenCalledWith(expected);
      expect(h.redirect).toHaveBeenCalledWith(`/admin/companies?error=${code}`);
    },
  );

  it.each(wrappers)(
    "redirects successful $name actions with ok=1",
    async ({ index }) => {
      const tree = await AdminCompaniesPage({
        searchParams: Promise.resolve({}),
      });
      await expect(formActions(tree)[index](new FormData())).rejects.toThrow(
        "REDIRECT:",
      );
      expect(h.redirect).toHaveBeenCalledWith("/admin/companies?ok=1");
    },
  );
});
