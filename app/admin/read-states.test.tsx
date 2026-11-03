import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";

const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("@/components/admin/InviteUserForm", () => ({
  InviteUserForm: () => null,
}));
vi.mock("@/components/admin/NewInvoiceDialog", () => ({
  NewInvoiceDialog: () => null,
}));
vi.mock("@/components/admin/NewProjectDialog", () => ({
  NewProjectDialog: () => null,
}));

import AdminOverview from "./page";
import AdminBookingsPage from "./bookings/page";
import AdminUsersPage from "./users/page";
import AdminTicketsPage from "./tickets/page";
import AdminInvoicesPage from "./invoices/page";
import AdminProjectsPage from "./projects/page";

function stubReads(failedTable?: string) {
  const tables = Object.fromEntries(
    [
      "leads",
      "bookings",
      "profiles",
      "work_orders",
      "invoices",
      "projects",
      "companies",
    ].map((table) => [
      table,
      {
        selectSingle: {
          data: failedTable === table ? null : [],
          error:
            failedTable === table
              ? { message: "private database details" }
              : null,
        },
      },
    ]),
  );
  const base = buildStubClient({ tables });
  const from = base.supabase.from.getMockImplementation()!;
  vi.spyOn(base.supabase, "from").mockImplementation((table: string) => {
    const api = from(table);
    const select = api.select;
    api.select = vi.fn((...args: unknown[]) => {
      const chain = select(...args);
      Object.assign(chain, { gte: vi.fn(() => chain) });
      return chain;
    });
    return api;
  });
  h.createAdminClient.mockReturnValue({
    ...base.supabase,
    auth: {
      ...base.supabase.auth,
      admin: {
        listUsers: vi.fn(async () => ({
          data: { users: [] },
          error:
            failedTable === "auth" ? { message: "private auth details" } : null,
        })),
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubReads();
});
afterEach(cleanup);

const lists = [
  {
    name: "bookings",
    Page: AdminBookingsPage,
    tables: ["bookings"],
    empty: /No bookings yet/,
  },
  {
    name: "users",
    Page: AdminUsersPage,
    tables: ["profiles", "auth"],
    empty: /No users yet/,
  },
  {
    name: "tickets",
    Page: AdminTicketsPage,
    tables: ["work_orders"],
    empty: /No tickets matching/,
  },
  {
    name: "invoices",
    Page: AdminInvoicesPage,
    tables: ["invoices", "profiles", "projects", "auth"],
    empty: /No invoices yet/,
  },
  {
    name: "projects",
    Page: AdminProjectsPage,
    tables: ["projects", "profiles", "companies"],
    empty: /No projects yet/,
  },
];

describe.each(lists)("$name read states", ({ Page, tables, empty }) => {
  it.each(tables)(
    "shows an alert without empty copy on %s failure",
    async (table) => {
      stubReads(table);
      render(await Page({ searchParams: Promise.resolve({}) }));
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.queryByText(empty)).not.toBeInTheDocument();
    },
  );
  it("shows empty copy without an alert on a successful empty read", async () => {
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(empty)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("overview read states", () => {
  it.each([
    { table: "leads", label: "New leads (30d)", empty: /No leads yet/ },
    {
      table: "bookings",
      label: "Upcoming bookings",
      empty: /No upcoming bookings yet/,
    },
    {
      table: "invoices",
      label: "Open invoice total",
      empty: /No invoices yet/,
    },
    { table: "profiles", label: "Client users", empty: /No users yet/ },
  ])(
    "does not report failed $table reads as zero",
    async ({ table, label, empty }) => {
      stubReads(table);
      render(await AdminOverview({ searchParams: Promise.resolve({}) }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to load some overview data. Try again.",
      );
      expect(screen.queryByText(empty)).not.toBeInTheDocument();
      expect(
        screen.getAllByText(label).find((node) => node.tagName === "P")
          ?.previousElementSibling,
      ).toHaveTextContent("\u2014");
    },
  );
  it("shows empty sections without alerts after successful reads", async () => {
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/No leads yet/)).toBeInTheDocument();
    expect(screen.getByText("No upcoming bookings yet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
