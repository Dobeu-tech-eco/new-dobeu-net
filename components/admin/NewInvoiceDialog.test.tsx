import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewInvoiceDialog } from "./NewInvoiceDialog";

const h = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/actions/invoices", () => ({
  createInvoice: h.create,
}));

const CLIENT_A = "00000000-0000-0000-0000-000000000001";
const CLIENT_B = "00000000-0000-0000-0000-000000000002";
const PROJECT_A = "00000000-0000-0000-0000-000000000010";
const PROJECT_B = "00000000-0000-0000-0000-000000000011";
const WO_A = "00000000-0000-0000-0000-000000000020";
const WO_B = "00000000-0000-0000-0000-000000000021";
const WO_C = "00000000-0000-0000-0000-000000000022";

const props = {
  users: [
    { id: CLIENT_A, label: "Client A" },
    { id: CLIENT_B, label: "Client B" },
  ],
  projects: [
    { id: PROJECT_A, label: "A project", ownerUserId: CLIENT_A },
    { id: PROJECT_B, label: "B project", ownerUserId: CLIENT_B },
  ],
  workOrders: [
    { id: WO_A, label: "A work order", clientUserId: CLIENT_A },
    { id: WO_B, label: "B work order", clientUserId: CLIENT_B },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.create.mockResolvedValue({
    ok: true,
    data: { id: "inv_1", stripe_invoice_id: "in_1", hosted_invoice_url: null },
  });
});
afterEach(cleanup);

function openAndPickClient() {
  fireEvent.click(screen.getByRole("button", { name: "New invoice" }));
  fireEvent.change(screen.getByLabelText("Recipient"), {
    target: { value: CLIENT_A },
  });
}

function submit() {
  fireEvent.submit(screen.getByLabelText("Amount (USD)").closest("form")!);
}

describe("NewInvoiceDialog", () => {
  it("accepts a no-project payload, omitting project_id and work_order_id", async () => {
    render(<NewInvoiceDialog {...props} />);
    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "500" },
    });
    submit();
    await waitFor(() =>
      expect(h.create).toHaveBeenCalledWith({
        user_id: CLIENT_A,
        amount_cents: 50000,
        description: null,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("submits the selected project and work order", async () => {
    render(<NewInvoiceDialog {...props} />);
    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Project (optional)"), {
      target: { value: PROJECT_A },
    });
    fireEvent.change(screen.getByLabelText("Work order (optional)"), {
      target: { value: WO_A },
    });
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "123.45" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Milestone 1" },
    });
    submit();
    await waitFor(() =>
      expect(h.create).toHaveBeenCalledWith({
        user_id: CLIENT_A,
        amount_cents: 12345,
        description: "Milestone 1",
        project_id: PROJECT_A,
        work_order_id: WO_A,
      }),
    );
  });

  it("filters projects and work orders by client and clears stale selections", () => {
    render(<NewInvoiceDialog {...props} />);
    openAndPickClient();
    const project = screen.getByLabelText("Project (optional)");
    const workOrder = screen.getByLabelText("Work order (optional)");
    expect(
      within(project).getByRole("option", { name: "A project" }),
    ).toBeInTheDocument();
    expect(
      within(project).queryByRole("option", { name: "B project" }),
    ).not.toBeInTheDocument();
    expect(
      within(workOrder).getByRole("option", { name: "A work order" }),
    ).toBeInTheDocument();
    expect(
      within(workOrder).queryByRole("option", { name: "B work order" }),
    ).not.toBeInTheDocument();
    fireEvent.change(project, { target: { value: PROJECT_A } });
    fireEvent.change(workOrder, { target: { value: WO_A } });
    fireEvent.change(screen.getByLabelText("Recipient"), {
      target: { value: CLIENT_B },
    });
    expect(project).toHaveValue("");
    expect(workOrder).toHaveValue("");
    expect(
      within(project).getByRole("option", { name: "B project" }),
    ).toBeInTheDocument();
    expect(
      within(workOrder).getByRole("option", { name: "B work order" }),
    ).toBeInTheDocument();
  });

  it("requires a recipient and a positive amount", async () => {
    render(<NewInvoiceDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "New invoice" }));
    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Pick a recipient."),
    );
    fireEvent.change(screen.getByLabelText("Recipient"), {
      target: { value: CLIENT_A },
    });
    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Amount must be a positive dollar value.",
      ),
    );
    expect(h.create).not.toHaveBeenCalled();
  });

  it("shows returned action errors inside the dialog", async () => {
    h.create.mockResolvedValue({ ok: false, error: "Project must belong to the recipient" });
    render(<NewInvoiceDialog {...props} />);
    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "10" },
    });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Project must belong to the recipient",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // The submit transition can still be settling under load; wait for the
    // button to return to its idle label before asserting its state.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Stripe invoice" }),
      ).toBeEnabled(),
    );
  });

  it("locks the form after a Stripe failure instead of inviting a retry", async () => {
    h.create.mockResolvedValue({ ok: false, error: "Stripe error: declined" });
    render(<NewInvoiceDialog {...props} />);
    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "10" },
    });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invoice saved, but Stripe failed. It is listed with no Stripe link. Do not submit again; fix the Stripe configuration and set the unsent invoice's status to void in Supabase if it should not stand (it has no Stripe invoice).",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Stripe invoice" }),
      ).toBeDisabled(),
    );
    const calls = h.create.mock.calls.length;
    submit();
    await waitFor(() =>
      expect(h.create.mock.calls.length).toBe(calls),
    );
  });

  it("shows a non-blocking notice naming the returned invoice id and blocks resubmit when the work-order link failed", async () => {
    h.create.mockResolvedValue({
      ok: true,
      data: {
        id: "inv_link_failed_9",
        stripe_invoice_id: "in_1",
        hosted_invoice_url: null,
        linkFailed: true,
      },
    });
    render(<NewInvoiceDialog {...props} />);
    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Work order (optional)"), {
      target: { value: WO_A },
    });
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "10" },
    });
    submit();
    const notice = await screen.findByRole("status");
    await waitFor(() => {
      expect(notice).toHaveTextContent(
        "Invoice inv_link_failed_9 was created but could not be linked to the work order.",
      );
      expect(notice).toHaveTextContent(
        "work_orders.invoice_id = inv_link_failed_9",
      );
      expect(notice).toHaveTextContent("/admin/invoices");
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Stripe invoice" }),
      ).toBeDisabled(),
    );
    submit();
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("keeps the form locked for the same work order after closing and reopening", async () => {
    h.create.mockResolvedValue({
      ok: true,
      data: {
        id: "inv_link_failed_9",
        stripe_invoice_id: "in_1",
        hosted_invoice_url: null,
        linkFailed: true,
      },
    });
    render(<NewInvoiceDialog {...props} />);
    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Work order (optional)"), {
      target: { value: WO_A },
    });
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "10" },
    });
    submit();
    expect(await screen.findByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Work order (optional)"), {
      target: { value: WO_A },
    });
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "20" },
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Invoice inv_link_failed_9 was created but could not be linked to the work order",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Stripe invoice" }),
      ).toBeDisabled(),
    );
    submit();
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1));

    // A different work order is not locked.
    fireEvent.change(screen.getByLabelText("Work order (optional)"), {
      target: { value: "" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Stripe invoice" }),
      ).toBeEnabled(),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("names each work order's own invoice in the link-failed notice", async () => {
    h.create
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "inv_for_a", stripe_invoice_id: "in_a", hosted_invoice_url: null, linkFailed: true },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "inv_for_a2", stripe_invoice_id: "in_a2", hosted_invoice_url: null, linkFailed: true },
      });
    const twoOrders = {
      ...props,
      workOrders: [
        ...props.workOrders,
        { id: WO_C, label: "A second work order", clientUserId: CLIENT_A },
      ],
    };
    render(<NewInvoiceDialog {...twoOrders} />);
    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Work order (optional)"), {
      target: { value: WO_A },
    });
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "10" },
    });
    submit();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Invoice inv_for_a was created"),
    );

    // Switching to the second work order clears the first notice, and its own
    // link failure names its own invoice id.
    fireEvent.change(screen.getByLabelText("Work order (optional)"), {
      target: { value: WO_C },
    });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Stripe invoice" }),
      ).toBeEnabled(),
    );
    submit();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Invoice inv_for_a2 was created"),
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("inv_for_a was");

    // Back on the first work order the original id is still the one named.
    fireEvent.change(screen.getByLabelText("Work order (optional)"), {
      target: { value: WO_A },
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Invoice inv_for_a was created"),
    );
  });

  it("keeps the Stripe-failure lock for the same client and amount after reopening", async () => {
    h.create.mockResolvedValue({ ok: false, error: "Stripe error: declined" });
    render(<NewInvoiceDialog {...props} />);
    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "10" },
    });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invoice saved, but Stripe failed.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "10" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Do not submit again");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Stripe invoice" }),
      ).toBeDisabled(),
    );
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "11" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Stripe invoice" }),
      ).toBeEnabled(),
    );
  });

  it("shows the server-side unsent-duplicate rejection and stays editable", async () => {
    const message =
      "An unsent invoice for this client and amount already exists from the last 24 hours (the Stripe call failed). The unsent invoice has no Stripe invoice; set its status to void in Supabase before creating another.";
    h.create.mockResolvedValue({ ok: false, error: message });
    render(<NewInvoiceDialog {...props} />);
    openAndPickClient();
    fireEvent.change(screen.getByLabelText("Amount (USD)"), {
      target: { value: "10" },
    });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows empty disabled pickers until a recipient is selected", () => {
    render(<NewInvoiceDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "New invoice" }));
    const project = screen.getByLabelText("Project (optional)");
    const workOrder = screen.getByLabelText("Work order (optional)");
    expect(project).toBeDisabled();
    expect(workOrder).toBeDisabled();
    expect(
      within(project).queryByRole("option", { name: "A project" }),
    ).not.toBeInTheDocument();
    expect(
      within(workOrder).queryByRole("option", { name: "A work order" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Recipient"), {
      target: { value: CLIENT_A },
    });
    expect(project).toBeEnabled();
    expect(workOrder).toBeEnabled();
    expect(
      within(project).getByRole("option", { name: "A project" }),
    ).toBeInTheDocument();
    expect(
      within(workOrder).getByRole("option", { name: "A work order" }),
    ).toBeInTheDocument();
  });

  it("disables the trigger with no users", () => {
    render(<NewInvoiceDialog {...props} users={[]} />);
    const trigger = screen.getByRole("button", { name: "No users yet" });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(h.create).not.toHaveBeenCalled();
  });
});
