import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));

import AdminOverview from "./page";

type Result = { data?: unknown; count?: number | null; error: unknown };

const tileValue = (label: string) =>
  screen.getAllByText(label).find((n) => n.tagName === "P")
    ?.previousElementSibling;

function stub(opts: {
  list: Result;
  count: Result;
  gte?: (...args: unknown[]) => void;
  // Per-table overrides, and per-status work_orders head counts.
  tables?: Record<string, Result>;
  // Overrides `tables` for head-count queries on the same table.
  headTables?: Record<string, Result>;
  gteAll?: (table: string, ...args: unknown[]) => void;
  statusCounts?: Record<string, Result>;
  selects?: (table: string, cols: string) => void;
}) {
  const ok: Result = { data: [], count: 0, error: null };
  h.createAdminClient.mockReturnValue({
    from: (table: string) => ({
      select: (cols: string, o?: { head?: boolean }) => {
        opts.selects?.(table, cols);
        let result =
          table === "leads"
            ? o?.head
              ? opts.count
              : opts.list
            : ((o?.head ? opts.headTables?.[table] : undefined) ??
              opts.tables?.[table] ??
              ok);
        const chain: Record<string, unknown> = {
          then: (resolve: (v: Result) => void) => resolve(result),
        };
        for (const m of ["order", "limit", "in"]) chain[m] = () => chain;
        chain.eq = (col: string, val: string) => {
          if (table === "work_orders" && col === "status" && o?.head) {
            result = opts.statusCounts?.[val] ?? ok;
          }
          return chain;
        };
        chain.gte = (...args: unknown[]) => {
          if (table === "leads" && o?.head) opts.gte?.(...args);
          opts.gteAll?.(table, ...args);
          return chain;
        };
        return chain;
      },
    }),
  });
}

const tenLeads = Array.from({ length: 10 }, (_, i) => ({
  id: `l${i}`,
  email: `l${i}@example.com`,
  name: `Lead ${i}`,
  source: "form",
  first_seen: "2026-10-01T00:00:00Z",
  utm_source: null,
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("admin overview leads tile", () => {
  it("shows the exact 30d count, not the list length", async () => {
    const gte = vi.fn();
    stub({
      list: { data: tenLeads, error: null },
      count: { count: 42, error: null },
      gte,
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("New leads (30d)")).toHaveTextContent("42");
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(gte).toHaveBeenCalledTimes(1);
    const [col, iso] = gte.mock.calls[0];
    expect(col).toBe("first_seen");
    const ageMs = Date.now() - new Date(iso as string).getTime();
    expect(Math.abs(ageMs - 30 * 24 * 60 * 60 * 1000)).toBeLessThan(2 * 60 * 60 * 1000);
  });

  it("shows an em dash when the count query errors", async () => {
    stub({
      list: { data: tenLeads, error: null },
      count: { count: null, error: { message: "private" } },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("New leads (30d)")).toHaveTextContent("—");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("keeps the exact count but hides the list when only the list errors", async () => {
    stub({
      list: { data: null, error: { message: "private" } },
      count: { count: 42, error: null },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("New leads (30d)")).toHaveTextContent("42");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/No leads yet/)).not.toBeInTheDocument();
  });
});

const emptyLeads = {
  list: { data: [], error: null },
  count: { count: 0, error: null },
};
const boom = { data: null, count: null, error: { message: "private" } };

describe("admin overview metrics", () => {
  it("shows each new tile value", async () => {
    stub({
      ...emptyLeads,
      tables: {
        invoices: {
          data: [
            { amount_cents: 1000, status: "open" },
            { amount_cents: 2500, status: "open" },
            { amount_cents: 400, status: "overdue" },
          ],
          error: null,
        },
        profiles: { count: 7, error: null },
        companies: { count: 3, error: null },
        projects: { count: 4, error: null },
      },
      statusCounts: {
        open: { count: 5, error: null },
        in_progress: { count: 2, error: null },
      },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("Open invoice total")).toHaveTextContent("$35");
    expect(tileValue("Overdue invoice total")).toHaveTextContent("$4");
    expect(tileValue("Client users")).toHaveTextContent("7");
    expect(tileValue("Companies")).toHaveTextContent("3");
    expect(tileValue("Active projects")).toHaveTextContent("4");
    expect(tileValue("Work orders: open")).toHaveTextContent("5");
    expect(tileValue("Work orders: in progress")).toHaveTextContent("2");
    expect(tileValue("Work orders: quoted")).toHaveTextContent("0");
  });

  it.each([
    ["companies", "Companies"],
    ["projects", "Active projects"],
    ["profiles", "Client users"],
    ["invoices", "Paid (30d)"],
    ["invoices", "Overdue invoice total"],
  ])("shows an em dash on a %s error for %s", async (table, label) => {
    stub({ ...emptyLeads, tables: { [table]: boom } });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue(label)).toHaveTextContent("—");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows an em dash only on the failing work-order status tile", async () => {
    stub({
      ...emptyLeads,
      statusCounts: { quoted: boom, open: { count: 1, error: null } },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("Work orders: quoted")).toHaveTextContent("—");
    expect(tileValue("Work orders: open")).toHaveTextContent("1");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("sums paid invoices", async () => {
    stub({
      ...emptyLeads,
      tables: {
        invoices: {
          data: [{ amount_cents: 12300, status: "paid" }],
          error: null,
        },
      },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("Paid (30d)")).toHaveTextContent("$123");
  });

  it("shows em dashes and a notice when invoice rows exceed the sum slice", async () => {
    stub({
      ...emptyLeads,
      tables: {
        invoices: {
          data: [
            { amount_cents: 1000, status: "open" },
            { amount_cents: 400, status: "overdue" },
          ],
          error: null,
        },
      },
      headTables: { invoices: { count: 1500, error: null } },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("Open invoice total")).toHaveTextContent("—");
    expect(tileValue("Overdue invoice total")).toHaveTextContent("—");
    expect(tileValue("Paid (30d)")).toHaveTextContent("—");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Totals truncated; too many rows to sum here",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows sums and no notice when the count matches the rows", async () => {
    stub({
      ...emptyLeads,
      tables: {
        invoices: {
          data: [{ amount_cents: 1000, status: "open" }],
          error: null,
        },
      },
      headTables: { invoices: { count: 1, error: null } },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("Open invoice total")).toHaveTextContent("$10");
    expect(screen.queryByText(/Totals truncated/)).not.toBeInTheDocument();
  });

  it("selects only bounded columns for invoice sums", async () => {
    const selects = vi.fn();
    stub({ ...emptyLeads, selects });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    const invoiceCols = selects.mock.calls
      .filter(([t]) => t === "invoices")
      .map(([, c]) => c);
    expect(invoiceCols).toContain("amount_cents,status");
    expect(selects.mock.calls.some(([, c]) => c === "*")).toBe(false);
  });
});

describe("admin overview activity feed", () => {
  const feedTables = {
    work_orders: {
      data: [
        {
          id: "w1",
          title: "Logo refresh",
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-05T00:00:00Z",
        },
      ],
      error: null,
    },
    invoices: {
      data: [
        {
          id: "i1",
          amount_cents: 5000,
          currency: "usd",
          created_at: "2026-10-02T00:00:00Z",
          paid_at: "2026-10-07T00:00:00Z",
        },
      ],
      error: null,
    },
    projects: {
      data: [
        { id: "p1", title: "Site build", updated_at: "2026-10-03T00:00:00Z" },
      ],
      error: null,
    },
    admin_audit_log: {
      data: [
        {
          id: "a1",
          action: "invoice.create",
          target_type: "invoice",
          created_at: "2026-10-06T00:00:00Z",
          data: { email: "secret@example.com" },
        },
      ],
      error: null,
    },
  };

  const feedItems = () =>
    screen
      .getByRole("heading", { name: "Recent activity" })
      .closest("section")!
      .querySelectorAll("li");

  it("merges sources newest first with links and no audit data", async () => {
    stub({ ...emptyLeads, tables: feedTables });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    const items = [...feedItems()].map((li) => li.textContent);
    expect(items[0]).toContain("Invoice paid");
    expect(items[1]).toContain("invoice.create (invoice)");
    expect(items[2]).toContain("Ticket updated: Logo refresh");
    expect(items[3]).toContain("Project updated: Site build");
    expect(
      screen.getByRole("link", { name: /Ticket updated/ }),
    ).toHaveAttribute("href", "/admin/tickets/w1");
    expect(
      screen.getByRole("link", { name: /Project updated/ }),
    ).toHaveAttribute("href", "/admin/projects/p1");
    expect(screen.getByRole("link", { name: /Invoice paid/ })).toHaveAttribute(
      "href",
      "/admin/invoices",
    );
    expect(document.body).not.toHaveTextContent("secret@example.com");
  });

  it("lists payments from the paid source and invoice creations separately", async () => {
    const gteAll = vi.fn();
    stub({
      ...emptyLeads,
      gteAll,
      tables: {
        invoices: {
          data: [
            {
              id: "old",
              amount_cents: 900,
              created_at: "2026-01-01T00:00:00Z",
              paid_at: "2026-10-09T00:00:00Z",
            },
          ],
          error: null,
        },
      },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(gteAll).toHaveBeenCalledWith(
      "invoices",
      "paid_at",
      "1970-01-01T00:00:00Z",
    );
    const items = [...feedItems()].map((li) => li.textContent);
    expect(items[0]).toContain("Invoice paid: $9");
    expect(items.filter((t) => t?.includes("Invoice created"))).toHaveLength(1);
    expect(items.filter((t) => t?.includes("Invoice paid"))).toHaveLength(1);
  });

  it("drops a failed source with a non-blocking notice", async () => {
    stub({
      ...emptyLeads,
      tables: { ...feedTables, admin_audit_log: boom },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Some recent activity could not be loaded.",
    );
    expect(screen.queryByText(/invoice\.create/)).not.toBeInTheDocument();
    expect(screen.getByText(/Ticket updated/)).toBeInTheDocument();
    expect(screen.queryByText("No recent activity.")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("caps the merged feed at 15 entries", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `w${i}`,
      title: `T${i}`,
      created_at: `2026-10-0${(i % 9) + 1}T00:00:00Z`,
      updated_at: `2026-10-0${(i % 9) + 1}T00:00:00Z`,
    }));
    stub({
      ...emptyLeads,
      tables: {
        ...feedTables,
        work_orders: { data: many, error: null },
        projects: {
          data: many.map((m) => ({
            id: m.id,
            title: m.title,
            updated_at: m.updated_at,
          })),
          error: null,
        },
      },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(feedItems()).toHaveLength(15);
  });
});
