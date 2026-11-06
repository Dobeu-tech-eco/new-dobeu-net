import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/components/admin/AdminQuoteForm", () => ({
  AdminQuoteForm: () => null,
}));
vi.mock("@/components/admin/AdminStatusButtons", () => ({
  AdminStatusButtons: () => null,
}));
vi.mock("@/components/admin/AdminMarkPaidButton", () => ({
  AdminMarkPaidButton: ({ invoiceId }: { invoiceId: string }) => (
    <span data-testid="mark-paid">{invoiceId}</span>
  ),
}));
vi.mock("@/components/admin/AdminCreateInvoiceButton", () => ({
  AdminCreateInvoiceButton: ({
    workOrderId,
    amountCents,
  }: {
    workOrderId: string;
    amountCents: number;
  }) => (
    <span data-testid="create-invoice">
      {workOrderId}:{amountCents}
    </span>
  ),
}));

import AdminTicketDetailPage from "./page";

type Res = { data: unknown; error: { message: string } | null };

const ticket = {
  id: "wo-1",
  title: "Fix the logo",
  service_type: "logo",
  status: "accepted",
  created_at: "2026-10-01T00:00:00Z",
  created_by: "user-1",
  description: null,
  quoted_amount_cents: 25000,
  quoted_at: "2026-10-02T00:00:00Z",
  invoice_id: null as string | null,
};
const linkedInvoice = (status: string) => ({
  id: "inv-1",
  amount_cents: 25000,
  status,
  hosted_invoice_url: null,
  stripe_invoice_id: "in_1",
});

function stubPage(
  workOrder: typeof ticket,
  invoice: Res = { data: null, error: { message: "not read" } },
) {
  const chain = (res: Res) => {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      order: () => b,
      single: () => Promise.resolve(res),
      then: (resolve: (v: Res) => void) => resolve(res),
    };
    return b;
  };
  h.createAdminClient.mockReturnValue({
    from: (table: string) =>
      table === "work_orders"
        ? chain({ data: workOrder, error: null })
        : table === "invoices"
          ? chain(invoice)
          : chain({ data: [], error: null }),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: { email: "client@example.com", user_metadata: {} } },
        }),
      },
    },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
  });
}

const renderPage = async () =>
  render(
    await AdminTicketDetailPage({ params: Promise.resolve({ id: "wo-1" }) }),
  );

beforeEach(() => h.createAdminClient.mockReset());
afterEach(cleanup);

describe("admin ticket detail billing gates", () => {
  it("shows the Bill section without a voided note when there is no invoice", async () => {
    stubPage(ticket);
    await renderPage();
    expect(screen.getByText("Bill this work order")).toBeInTheDocument();
    expect(screen.getByTestId("create-invoice")).toHaveTextContent("wo-1:25000");
    expect(screen.queryByText(/previous invoice was voided/)).not.toBeInTheDocument();
    expect(screen.queryByText("Linked invoice")).not.toBeInTheDocument();
  });

  it("shows the Bill section with a replacement note when the linked invoice is void", async () => {
    stubPage(
      { ...ticket, invoice_id: "inv-1" },
      { data: linkedInvoice("void"), error: null },
    );
    await renderPage();
    expect(screen.getByText("Bill this work order")).toBeInTheDocument();
    expect(screen.getByTestId("create-invoice")).toHaveTextContent("wo-1:25000");
    expect(
      screen.getByText(/The previous invoice was voided; the new invoice replaces it\./),
    ).toBeInTheDocument();
  });

  it("keeps the void invoice summary but offers no Mark paid for it", async () => {
    stubPage(
      { ...ticket, invoice_id: "inv-1" },
      { data: linkedInvoice("void"), error: null },
    );
    await renderPage();
    expect(screen.getByText("Linked invoice")).toBeInTheDocument();
    expect(screen.getByLabelText("Invoice status: void")).toBeInTheDocument();
    expect(screen.queryByTestId("mark-paid")).not.toBeInTheDocument();
  });

  it.each(["open", "overdue", "paid"])(
    "hides the Bill section when the linked invoice is %s",
    async (status) => {
      stubPage(
        { ...ticket, invoice_id: "inv-1" },
        { data: linkedInvoice(status), error: null },
      );
      await renderPage();
      expect(screen.queryByText("Bill this work order")).not.toBeInTheDocument();
      expect(screen.queryByTestId("create-invoice")).not.toBeInTheDocument();
      expect(screen.getByText("Linked invoice")).toBeInTheDocument();
      if (status === "paid") {
        expect(screen.queryByTestId("mark-paid")).not.toBeInTheDocument();
      } else {
        expect(screen.getByTestId("mark-paid")).toHaveTextContent("inv-1");
      }
    },
  );

  it("fails closed (no Bill section) when the linked invoice read fails", async () => {
    stubPage({ ...ticket, invoice_id: "inv-1" });
    await renderPage();
    expect(screen.queryByText("Bill this work order")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The linked invoice could not be loaded",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Reload this page");
  });

  it("shows no load notice when the linked invoice reads fine", async () => {
    stubPage(
      { ...ticket, invoice_id: "inv-1" },
      { data: linkedInvoice("open"), error: null },
    );
    await renderPage();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([0, -500])("hides the Bill section for a quote of %i", async (cents) => {
    stubPage({ ...ticket, quoted_amount_cents: cents });
    await renderPage();
    expect(screen.queryByText("Bill this work order")).not.toBeInTheDocument();
    expect(screen.queryByTestId("create-invoice")).not.toBeInTheDocument();
  });

  it("hides the Bill section for a void-linked work order that is not accepted", async () => {
    stubPage(
      { ...ticket, status: "in_progress", invoice_id: "inv-1" },
      { data: linkedInvoice("void"), error: null },
    );
    await renderPage();
    expect(screen.queryByText("Bill this work order")).not.toBeInTheDocument();
  });
});
