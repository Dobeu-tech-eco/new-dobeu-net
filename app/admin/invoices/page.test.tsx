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

function client(tables: Record<string, Res>, listUsers: () => Promise<Res>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
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
      from: (t: string) => chain(t, tables[t] ?? ok([])),
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
  tables: Record<string, Res>,
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

  it("reads only un-invoiced accepted work orders, newest first", async () => {
    const c = stubPage({
      invoices: ok([invoice]),
      profiles: ok([]),
      projects: ok([]),
      work_orders: ok([
        { id: "wo-1", title: "Fix logo", created_by: "user-1" },
      ]),
    });
    render(await AdminInvoicesPage(params));
    expect(h.dialogProps?.workOrders).toEqual([
      { id: "wo-1", label: "Fix logo", clientUserId: "user-1" },
    ]);
    expect(c.calls).toContainEqual({
      table: "work_orders",
      method: "is",
      args: ["invoice_id", null],
    });
    expect(c.calls).toContainEqual({
      table: "work_orders",
      method: "eq",
      args: ["status", "accepted"],
    });
    expect(c.calls).toContainEqual({
      table: "work_orders",
      method: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(c.calls).toContainEqual({
      table: "work_orders",
      method: "limit",
      args: [500],
    });
    expect(screen.queryByText(/New Invoice picker could not/)).not.toBeInTheDocument();
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
