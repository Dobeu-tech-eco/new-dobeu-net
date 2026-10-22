import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";

const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));

import AdminLeadsPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  h.createAdminClient.mockReturnValue(
    buildStubClient({ tables: { leads: { selectSingle: { data: [] } } } })
      .supabase,
  );
});
afterEach(cleanup);

describe("admin leads errors", () => {
  it("renders query-string errors as an alert", async () => {
    render(
      await AdminLeadsPage({
        searchParams: Promise.resolve({ error: "Lead action failed" }),
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Lead action failed");
  });

  it("renders read failures without exposing database details", async () => {
    h.createAdminClient.mockReturnValue(
      buildStubClient({
        tables: {
          leads: {
            selectSingle: {
              data: null,
              error: {
                message: "relation private_schema.leads does not exist",
              },
            },
          },
        },
      }).supabase,
    );
    render(await AdminLeadsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load leads. Try again.",
    );
    expect(screen.queryByText(/private_schema/)).not.toBeInTheDocument();
  });

  it("keeps a successful empty read free of errors", async () => {
    render(await AdminLeadsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("No leads yet.")).toBeInTheDocument();
  });
});
