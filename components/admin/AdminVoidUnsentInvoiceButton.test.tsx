import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ voidFn: vi.fn() }));
vi.mock("@/lib/actions/invoices", () => ({ voidUnsentInvoice: h.voidFn }));

import { AdminVoidUnsentInvoiceButton } from "./AdminVoidUnsentInvoiceButton";

beforeEach(() => {
  h.voidFn.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminVoidUnsentInvoiceButton", () => {
  it("voids after confirmation", async () => {
    h.voidFn.mockResolvedValue({ ok: true, data: { id: "inv-1" } });
    render(<AdminVoidUnsentInvoiceButton invoiceId="inv-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Void unsent" }));
    await waitFor(() => expect(h.voidFn).toHaveBeenCalledWith({ id: "inv-1" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does nothing when the confirm is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminVoidUnsentInvoiceButton invoiceId="inv-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Void unsent" }));
    expect(h.voidFn).not.toHaveBeenCalled();
  });

  it("shows the refusal in an alert", async () => {
    h.voidFn.mockResolvedValue({ ok: false, error: "invoice has a Stripe invoice" });
    render(<AdminVoidUnsentInvoiceButton invoiceId="inv-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Void unsent" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invoice has a Stripe invoice");
  });

  it("shows a fixed message when the action throws", async () => {
    h.voidFn.mockRejectedValue(new Error("private"));
    render(<AdminVoidUnsentInvoiceButton invoiceId="inv-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Void unsent" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to void the invoice. Try again.");
  });
});
