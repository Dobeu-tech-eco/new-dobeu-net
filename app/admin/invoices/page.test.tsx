import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  dialogProps: null as {
    users: unknown[];
    projects: unknown[];
    workOrders: unknown[];
  } | null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("@/components/admin/NewInvoiceDialog", () => ({
  NewInvoiceDialog: (props: {
    users: unknown[];
    projects: unknown[];
    workOrders: unknown[];
  }) => {
    h.dialogProps = props;
    return null;
  },
}));
vi.mock("@/components/admin/AdminMarkPaidButton", () => ({
  AdminMarkPaidButton: ({ invoiceId }: { invoiceId: string }) => (
    <span data-testid={`mark-paid-${invoiceId}`}>mark paid</span>
  ),
}));
import AdminInvoicesPage from "./page";

type Res = { data: unknown; error: { message: string } | null };
const ok = (data: unknown): Res => ({ data, error: null });
const fail: Res = { data: null, error: { message: "private provider text" } };

// A table maps to one Res, or to one Res per `from(table)` call in order (the
// page reads work_orders twice: unbilled first, then void-linked).
type TableRes = Res | Res[];

function client(tables: Record<string, TableRes>, listUsers: () => Promise<Res>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const fromCount: Record<string, number> = {};
  const chain = (table: string, res: Res) => {
    const b: Record<string, unknown> = {
      select: (...a: unknown[]) => {
        calls.push({ table, method: "select", args: a });
        return b;
      },
      order: (...a: unknown[]) => {
        calls.push({ table, method: "order", args: a });
        return b;
      },
      limit: (...a: unknown[]) => {
        calls.push({ table, method: "limit", args: a });
        return b;
      },
      eq: (...a: unknown[]) => {
        calls.push({ table, method: "eq", args: a });
        return b;
      },
      is: (...a: unknown[]) => {
        calls.push({ table, method: "is", args: a });
        return b;
      },
      then: (resolve: (v: Res) => void) => resolve(res),
    };
    return b;
  };
  return {
    api: {
      from: (t: string) => {
        const n = (fromCount[t] = (fromCount[t] ?? 0) + 1);
        const res = tables[t];
        return chain(t, (Array.isArray(res) ? res[n - 1] : res) ?? ok([]));
      },
      auth: { admin: { listUsers } },
    },
    calls,
  };
}

const invoice = {
  id: "inv-12345678-aaaa",
  project_id: null,
  amount_cents: 12300,
  currency: "usd",
  status: "open",
  due_date: null,
  paid_at: null,
  stripe_invoice_id: null,
  hosted_invoice_url: null,
  created_at: "2026-01-01T00:00:00Z",
};
const params = { searchParams: Promise.resolve({}) };

beforeEach(() => {
  h.createAdminClient.mockReset();
  h.dialogProps = null;
});
afterEach(cleanup);

function stubPage(
  tables: Record<string, TableRes>,
  listUsers: () => Promise<Res> = async () => ok({ users: [] }),
) {
  const c = client(tables, listUsers);
  h.createAdminClient.mockReturnValue(c.api);
  return c;
}

describe("admin invoices page degradation", () => {
  it("still renders invoice rows when picker reads fail", async () => {
    stubPage(
      { invoices: ok([invoice]), profiles: fail, projects: fail },
      async () => {
        throw new Error("private provider text");
      },
    );
    const { container } = render(await AdminInvoicesPage(params));
    expect(screen.getByText("inv-1234…")).toBeInTheDocument();
    expect(
      screen.getByText(/New Invoice picker could not/),
    ).toBeInTheDocument();
    expect(screen.queryByText("No invoices yet.")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("private provider");
  });

  it("leaves the invoices table rendered with a notice when the work-order read fails", async () => {
    stubPage({
      invoices: ok([invoice]),
      profiles: ok([]),
      projects: ok([]),
      work_orders: fail,
    });
    const { container } = render(await AdminInvoicesPage(params));
    expect(screen.getByText("inv-1234…")).toBeInTheDocument();
    expect(
      screen.getByText(/New Invoice picker could not/),
    ).toBeInTheDocument();
    expect(screen.queryByText("No invoices yet.")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("private provider");
  });

  it("offers un-invoiced and void-linked accepted work orders, merged newest first", async () => {
    const c = stubPage({
      invoices: ok([invoice]),
      profiles: ok([]),
      projects: ok([]),
      work_orders: [
        ok([
          { id: "wo-new", title: "New", created_by: "user-1", created_at: "2026-10-03T00:00:00Z" },
          { id: "wo-old", title: "Old", created_by: "user-1", created_at: "2026-10-01T00:00:00Z" },
        ]),
        ok([
          {
            id: "wo-void",
            title: "Voided",
            created_by: "user-2",
            created_at: "2026-10-02T00:00:00Z",
            invoices: { status: "void" },
          },
        ]),
      ],
    });
    render(await AdminInvoicesPage(params));
    expect(h.dialogProps?.workOrders).toEqual([
      { id: "wo-new", label: "New", clientUserId: "user-1" },
      { id: "wo-void", label: "Voided", clientUserId: "user-2" },
      { id: "wo-old", label: "Old", clientUserId: "user-1" },
    ]);
    const wo = c.calls.filter((x) => x.table === "work_orders");
    expect(wo).toContainEqual({
      table: "work_orders",
      method: "is",
      args: ["invoice_id", null],
    });
    // The void read is an inner embed on the invoice FK filtered to void, so a
    // non-void linked work order can never match it.
    expect(wo).toContainEqual({
      table: "work_orders",
      method: "select",
      args: [
        "id,title,created_by,created_at,invoices!work_orders_invoice_id_fkey!inner(status)",
      ],
    });
    expect(wo).toContainEqual({
      table: "work_orders",
      method: "eq",
      args: ["invoices.status", "void"],
    });
    expect(wo.filter((x) => x.method === "eq" && x.args[0] === "status")).toEqual([
      { table: "work_orders", method: "eq", args: ["status", "accepted"] },
      { table: "work_orders", method: "eq", args: ["status", "accepted"] },
    ]);
    expect(
      wo.filter((x) => x.method === "order" || x.method === "limit"),
    ).toEqual([
      { table: "work_orders", method: "order", args: ["created_at", { ascending: false }] },
      { table: "work_orders", method: "limit", args: [500] },
      { table: "work_orders", method: "order", args: ["created_at", { ascending: false }] },
      { table: "work_orders", method: "limit", args: [500] },
    ]);
    expect(screen.queryByText(/New Invoice picker could not/)).not.toBeInTheDocument();
  });

  it("caps the merged picker list at 500, keeping the newest", async () => {
    const row = (id: string, day: number) => ({
      id,
      title: id,
      created_by: "user-1",
      created_at: `2026-01-01T00:00:${String(day).padStart(2, "0")}Z`,
    });
    const unbilled = Array.from({ length: 500 }, (_, i) =>
      row(`u${i}`, i % 50),
    );
    stubPage({
      invoices: ok([invoice]),
      work_orders: [ok(unbilled), ok([{ ...row("v-newest", 59), invoices: { status: "void" } }])],
    });
    render(await AdminInvoicesPage(params));
    const options = h.dialogProps?.workOrders as { id: string }[];
    expect(options).toHaveLength(500);
    expect(options[0].id).toBe("v-newest");
  });

  it("keeps the un-invoiced options and a non-blocking notice when the void-linked read fails", async () => {
    stubPage({
      invoices: ok([invoice]),
      profiles: ok([]),
      projects: ok([]),
      work_orders: [
        ok([{ id: "wo-1", title: "Fix logo", created_by: "user-1", created_at: "2026-10-01T00:00:00Z" }]),
        fail,
      ],
    });
    const { container } = render(await AdminInvoicesPage(params));
    expect(h.dialogProps?.workOrders).toEqual([
      { id: "wo-1", label: "Fix logo", clientUserId: "user-1" },
    ]);
    expect(screen.getByText("inv-1234…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/New Invoice picker could not/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("private provider");
  });

  it("shows the mark-paid button only for non-terminal invoices", async () => {
    const rows = (status: string) => ({
      ...invoice,
      id: `${status}-id-12345678`,
      status,
    });
    stubPage({ invoices: ok([rows("open"), rows("paid"), rows("void")]) });
    const { container } = render(await AdminInvoicesPage(params));
    expect(
      container.querySelector('[data-testid="mark-paid-open-id-12345678"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="mark-paid-paid-id-12345678"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="mark-paid-void-id-12345678"]'),
    ).not.toBeInTheDocument();
  });

  describe("paged auth users", () => {
    const authUsers = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `${prefix}${i}`,
        email: `${prefix}${i}@example.com`,
      }));
    const base = { invoices: ok([invoice]), profiles: ok([]), projects: ok([]) };

    it("includes page-2 users in the picker", async () => {
      const listUsers = vi
        .fn()
        .mockResolvedValueOnce(ok({ users: authUsers("a", 200) }))
        .mockResolvedValueOnce(ok({ users: authUsers("b", 2) }));
      stubPage(base, listUsers);
      render(await AdminInvoicesPage(params));
      expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 });
      const users = h.dialogProps?.users as { id: string }[];
      expect(users).toHaveLength(202);
      expect(users.map((u) => u.id)).toContain("b1");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows the picker failure notice when a later page fails", async () => {
      const listUsers = vi
        .fn()
        .mockResolvedValueOnce(ok({ users: authUsers("a", 200) }))
        .mockResolvedValueOnce(fail);
      stubPage(base, listUsers);
      const { container } = render(await AdminInvoicesPage(params));
      expect(h.dialogProps?.users).toEqual([]);
      expect(
        screen.getByText(/New Invoice picker could not/),
      ).toBeInTheDocument();
      expect(container.textContent).not.toContain("private provider");
    });

    it("shows the truncation notice at the 50-page cap", async () => {
      const listUsers = vi
        .fn()
        .mockImplementation(async () => ok({ users: authUsers("a", 200) }));
      stubPage(base, listUsers);
      render(await AdminInvoicesPage(params));
      expect(listUsers).toHaveBeenCalledTimes(50);
      expect(screen.getByRole("status")).toHaveTextContent(
        /client list is truncated/,
      );
    });
  });

  it("shows em dashes and hides the table when the invoices read fails", async () => {
    stubPage({ invoices: fail });
    const { container } = render(await AdminInvoicesPage(params));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load invoices. Try again.",
    );
    expect(screen.getByText(/Open:/).textContent).toBe(
      "Open: — · Open total: —",
    );
    expect(screen.queryByText("No invoices yet.")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("private provider");
  });
});
