import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const action = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/work-orders", () => ({ acceptWorkOrderQuote: (...a: unknown[]) => action(...a) }));

import { AcceptQuoteForm } from "./AcceptQuoteForm";

beforeEach(() => {
  refresh.mockReset();
  action.mockReset();
});
afterEach(cleanup);

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /accept quote/i }));
}

describe("AcceptQuoteForm", () => {
  it("shows plain copy and refreshes on status_conflict", async () => {
    action.mockResolvedValue({ ok: false, error: "status_conflict" });
    render(<AcceptQuoteForm ticketId="t1" amountCents={50000} />);
    submit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The page has been refreshed"));
    expect(screen.getByRole("alert")).not.toHaveTextContent("status_conflict");
    expect(refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });

  it("still shows other errors as returned and does not refresh", async () => {
    action.mockResolvedValue({ ok: false, error: "forbidden" });
    render(<AcceptQuoteForm ticketId="t1" amountCents={50000} />);
    submit();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("forbidden"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
