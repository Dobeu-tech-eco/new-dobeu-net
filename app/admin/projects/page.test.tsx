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
      screen.getByText("Unable to load all project data. Try again."),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getByText("Unable to save the project. Try again."),
    ).toHaveAttribute("role", "alert");
    expect(screen.queryByText(/private provider/)).not.toBeInTheDocument();
  });
});
