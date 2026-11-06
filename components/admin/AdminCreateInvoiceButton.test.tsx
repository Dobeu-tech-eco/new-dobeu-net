import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCreateInvoiceButton } from "./AdminCreateInvoiceButton";

const h = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/actions/invoices", () => ({
  createInvoiceForWorkOrder: h.create,
}));

const WO = "00000000-0000-0000-0000-000000000020";
const INVOICE_ID = "00000000-0000-0000-0000-000000000099";
const created = {
  id: INVOICE_ID,
  stripe_invoice_id: "in_1",
  hosted_invoice_url: "https://invoice.stripe.com/i/1",
};

const button = () => screen.getByRole("button");

function renderButton() {
  render(<AdminCreateInvoiceButton workOrderId={WO} amountCents={10000} />);
}

beforeEach(() => {
  h.create.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminCreateInvoiceButton", () => {
  it("shows no notice and stays enabled after a clean success", async () => {
    h.create.mockResolvedValue({ ok: true, data: created });
    renderButton();
    fireEvent.click(button());
    await waitFor(() => {
      expect(h.create).toHaveBeenCalledWith({ work_order_id: WO });
      expect(button()).toBeEnabled();
      expect(button()).toHaveTextContent("Create Stripe invoice ($100)");
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the id and manual remedy in a status notice and disables the button after a link failure", async () => {
    h.create.mockResolvedValue({ ok: true, data: { ...created, linkFailed: true } });
    renderButton();
    fireEvent.click(button());
    await waitFor(() => {
      const notice = screen.getByRole("status");
      expect(notice).toHaveTextContent(`Invoice ${INVOICE_ID} was created`);
      expect(notice).toHaveTextContent(
        `set work_orders.invoice_id = ${INVOICE_ID} in Supabase`,
      );
      expect(notice).toHaveTextContent(
        "void it in the Stripe dashboard (find it on /admin/invoices)",
      );
      expect(notice).toHaveTextContent("then reload this page");
      expect(button()).toBeDisabled();
      expect(button()).toHaveAttribute("aria-busy", "false");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(button());
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it("shows an error alert, not the link notice, when the action fails", async () => {
    h.create.mockResolvedValue({ ok: false, error: "Stripe error: nope" });
    renderButton();
    fireEvent.click(button());
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Stripe error: nope");
      expect(button()).toBeEnabled();
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("does not call the action when the admin declines the confirm", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderButton();
    fireEvent.click(button());
    expect(h.create).not.toHaveBeenCalled();
    expect(button()).toBeEnabled();
  });
});
