import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const action = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/work-orders", () => ({ quoteWorkOrder: (...a: unknown[]) => action(...a) }));

import { AdminQuoteForm } from "./AdminQuoteForm";

beforeEach(() => {
  refresh.mockReset();
  action.mockReset();
});
afterEach(cleanup);

function submit() {
  fireEvent.change(screen.getByLabelText(/quote amount/i), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: /send quote/i }));
}

describe("AdminQuoteForm", () => {
  it("shows plain copy and refreshes on status_conflict", async () => {
    action.mockResolvedValue({ ok: false, error: "status_conflict" });
    render(<AdminQuoteForm ticketId="t1" />);
    submit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The page has been refreshed"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("status_conflict");
    expect(refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });

  it("still shows other errors as returned and does not refresh", async () => {
    action.mockResolvedValue({ ok: false, error: "forbidden" });
    render(<AdminQuoteForm ticketId="t1" />);
    submit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("forbidden"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
