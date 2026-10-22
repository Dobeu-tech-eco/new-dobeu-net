import { Children, isValidElement, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";

const h = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  provisionCompanyAdmin: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("@/lib/actions/companies", () => ({
  provisionCompanyAdmin: h.provisionCompanyAdmin,
}));
vi.mock("next/navigation", () => ({
  redirect: h.redirect,
  notFound: h.notFound,
}));

import AdminCompanyDetailPage from "./page";

function provisionForm(
  node: ReactNode,
): ((data: FormData) => Promise<void>) | undefined {
  for (const child of Children.toArray(node)) {
    if (
      !isValidElement<{
        action?: (data: FormData) => Promise<void>;
        children?: ReactNode;
      }>(child)
    )
      continue;
    if (child.type === "form") return child.props.action;
    const action = provisionForm(child.props.children);
    if (action) return action;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  h.provisionCompanyAdmin.mockResolvedValue({ ok: true, data: {} });
  h.createAdminClient.mockReturnValue(
    buildStubClient({
      tables: {
        companies: {
          selectSingle: {
            data: {
              id: "company-id",
              name: "Acme",
              status: "active",
              created_at: "2026-10-20T12:00:00Z",
              stripe_customer_id: null,
            },
          },
        },
      },
    }).supabase,
  );
});
afterEach(cleanup);

describe("company detail action feedback", () => {
  it("renders errors as alerts", async () => {
    render(
      await AdminCompanyDetailPage({
        params: Promise.resolve({ id: "company-id" }),
        searchParams: Promise.resolve({ error: "Invite failed" }),
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Invite failed");
  });

  it("renders successful provisioning as a status", async () => {
    render(
      await AdminCompanyDetailPage({
        params: Promise.resolve({ id: "company-id" }),
        searchParams: Promise.resolve({ ok: "1" }),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Company admin provisioned successfully.",
    );
  });

  it.each([
    { result: { ok: true, data: {} }, query: "ok=1" },
    {
      result: { ok: false, error: "Suspended & inactive?" },
      query: `error=${encodeURIComponent("Suspended & inactive?")}`,
    },
  ])(
    "redirects provisioning back to the company with $query",
    async ({ result, query }) => {
      h.provisionCompanyAdmin.mockResolvedValue(result);
      const tree = await AdminCompanyDetailPage({
        params: Promise.resolve({ id: "company-id" }),
        searchParams: Promise.resolve({}),
      });
      const data = new FormData();
      data.set("companyId", "different-company");
      data.set("email", "admin@example.com");
      await expect(provisionForm(tree)!(data)).rejects.toThrow("REDIRECT:");
      expect(h.provisionCompanyAdmin).toHaveBeenCalledWith({
        companyId: "company-id",
        email: "admin@example.com",
      });
      expect(h.redirect).toHaveBeenCalledWith(
        `/admin/companies/company-id?${query}`,
      );
    },
  );
});
