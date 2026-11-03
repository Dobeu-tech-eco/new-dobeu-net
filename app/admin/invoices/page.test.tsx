import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("@/components/admin/NewInvoiceDialog", () => ({
  NewInvoiceDialog: () => null,
}));
vi.mock("@/components/admin/AdminMarkPaidButton", () => ({
  AdminMarkPaidButton: () => null,
}));
import AdminInvoicesPage from "./page";

type Res = { data: unknown; error: { message: string } | null };
const ok = (data: unknown): Res => ({ data, error: null });
const fail: Res = { data: null, error: { message: "private provider text" } };

function client(tables: Record<string, Res>, listUsers: () => Promise<Res>) {
  const chain = (res: Res) => {
    const b: Record<string, unknown> = {
      select: () => b,
      order: () => b,
      limit: () => b,
      then: (resolve: (v: Res) => void) => resolve(res),
    };
    return b;
  };
  return {
    from: (t: string) => chain(tables[t] ?? ok([])),
    auth: { admin: { listUsers } },
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
});
afterEach(cleanup);

describe("admin invoices page degradation", () => {
  it("still renders invoice rows when picker reads fail", async () => {
    h.createAdminClient.mockReturnValue(
      client(
        { invoices: ok([invoice]), profiles: fail, projects: fail },
        async () => {
          throw new Error("private provider text");
        },
      ),
    );
    const { container } = render(await AdminInvoicesPage(params));
    expect(screen.getByText("inv-1234…")).toBeInTheDocument();
    expect(
      screen.getByText(/New Invoice picker could not/),
    ).toBeInTheDocument();
    expect(screen.queryByText("No invoices yet.")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("private provider");
  });

  it("shows em dashes and hides the table when the invoices read fails", async () => {
    h.createAdminClient.mockReturnValue(
      client({ invoices: fail }, async () => ok({ users: [] })),
    );
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
