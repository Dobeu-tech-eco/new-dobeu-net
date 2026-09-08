import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: {
    rows: Record<string, unknown>[];
    error: { code: string; message: string } | null;
  } = { rows: [], error: null };
  const range = vi.fn(async () => ({ data: state.rows, error: state.error }));
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.range = range;
  const from = vi.fn(() => query);
  return { state, query, range, from };
});

vi.mock("@/lib/actions/auth", () => ({
  requireAdminAal2: vi.fn(async () => ({ admin: { from: h.from } })),
}));

import AdminIntakesPage from "./page";

function intake(index: number) {
  return {
    id: `intake-${index}`,
    status: "new",
    mapping_status: "mapped",
    email: `person-${index}@example.com`,
    name: `Intake ${index}`,
    company: null,
    service_family_ref: "web-app",
    service_family_label: "Web app",
    budget_band_ref: "10000-25000",
    budget_band_label: "$10,000-$25,000",
    submitted_at: "2026-08-29T12:00:00.000Z",
    received_at: "2026-08-29T12:01:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.rows = [];
  h.state.error = null;
});

afterEach(cleanup);

describe("AdminIntakesPage pagination", () => {
  it("renders 50 rows and a continuation link when one extra row exists", async () => {
    h.state.rows = Array.from({ length: 51 }, (_, index) => intake(index));

    render(
      await AdminIntakesPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getAllByText(/^Intake \d+$/)).toHaveLength(50);
    expect(h.range).toHaveBeenCalledWith(0, 50);
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute(
      "href",
      "/admin/intakes?page=2",
    );
  });

  it("preserves filters in page links and offers a way back from later pages", async () => {
    h.state.rows = [intake(50)];

    render(
      await AdminIntakesPage({
        searchParams: Promise.resolve({
          status: "new",
          mapping: "mapped",
          page: "2",
        }),
      }),
    );

    expect(h.query.eq).toHaveBeenCalledWith("status", "new");
    expect(h.query.eq).toHaveBeenCalledWith("mapping_status", "mapped");
    expect(h.range).toHaveBeenCalledWith(50, 100);
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute(
      "href",
      "/admin/intakes?status=new&mapping=mapped",
    );
  });

  it("renders a generic queue error without exposing database details", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    h.state.error = {
      code: "42P01",
      message: "relation internal_schema.secret_table does not exist",
    };

    render(
      await AdminIntakesPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByText("Unable to load the intake queue. Try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/internal_schema/i)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "[admin/intakes] queue query failed:",
      "42P01",
    );
  });
});
