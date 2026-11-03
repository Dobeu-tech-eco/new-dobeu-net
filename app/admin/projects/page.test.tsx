import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";

const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("@/components/admin/NewProjectDialog", () => ({
  NewProjectDialog: () => null,
}));
import AdminProjectsPage from "./page";

beforeEach(() => {
  h.createAdminClient.mockReturnValue(buildStubClient({}).supabase);
});
afterEach(cleanup);

describe("project page status", () => {
  it.each([
    "<script>alert(1)</script>",
    "https://evil.example",
    "x".repeat(500),
  ])("does not echo a query payload %s", async (error) => {
    const { container } = render(
      await AdminProjectsPage({ searchParams: Promise.resolve({ error }) }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Try again.",
    );
    expect(container.textContent).not.toContain(error);
  });
  it("keeps read failures visible with a query error", async () => {
    h.createAdminClient.mockReturnValue(
      buildStubClient({
        tables: {
          projects: {
            selectSingle: {
              data: null,
              error: { message: "private provider text" },
            },
          },
        },
      }).supabase,
    );
    render(
      await AdminProjectsPage({
        searchParams: Promise.resolve({ error: "project_save_failed" }),
      }),
    );
    expect(
      screen.getByText("Unable to load projects. Try again."),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getByText("Unable to save the project. Try again."),
    ).toHaveAttribute("role", "alert");
    expect(screen.queryByText(/private provider/)).not.toBeInTheDocument();
  });

  it("keeps project rows when owner, company and name lookups fail", async () => {
    const fail = { data: null, error: { message: "private provider text" } };
    const project = {
      id: "p1",
      title: "Alpha build",
      status: "active",
      total_cents: 5000,
      owner_user_id: "u1",
      company_id: "c1",
      started_at: null,
      delivered_at: null,
      created_at: "x",
    };
    h.createAdminClient.mockReturnValue({
      from: (table: string) => {
        const b: Record<string, unknown> = {
          select: () => b,
          order: () => b,
          limit: () => b,
          eq: () => b,
          in: () => b,
          then: (resolve: (v: unknown) => void) =>
            resolve(
              table === "projects" ? { data: [project], error: null } : fail,
            ),
        };
        return b;
      },
    });
    const { container } = render(
      await AdminProjectsPage({ searchParams: Promise.resolve({}) }),
    );
    expect(screen.getByText("Alpha build")).toBeInTheDocument();
    expect(screen.getByText("Company unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Projects are still shown/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("private provider");
  });
});
