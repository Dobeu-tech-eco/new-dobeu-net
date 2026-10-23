import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeadForm } from "./LeadForm";

const { toastSuccess, toastError, track } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  track: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock("@/lib/analytics", () => ({ track }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  track.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LeadForm", () => {
  it("sends a collaboration idea through the durable lead endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const onSuccess = vi.fn();
    render(<LeadForm source="form" onSuccess={onSuccess} />);

    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Company (optional)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "friend@example.com" },
    });
    fireEvent.change(screen.getByLabelText("What are you exploring?"), {
      target: { value: "Let's make local arts events easier to find." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send your idea" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/lead");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      email: "friend@example.com",
      message: "Let's make local arts events easier to find.",
      source: "form",
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(track).toHaveBeenCalledWith("lead_submitted", {
      source: "form",
      has_message: true,
    });
    expect(screen.getByText("Idea received.")).toBeInTheDocument();
  });

  it("keeps the form open when the lead endpoint rejects a submission", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "Please try again" }),
    });
    const onSuccess = vi.fn();
    render(<LeadForm source="form" onSuccess={onSuccess} />);

    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Company (optional)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "friend@example.com" },
    });
    fireEvent.change(screen.getByLabelText("What are you exploring?"), {
      target: { value: "A community project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send your idea" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Please try again"));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send your idea" })).toBeEnabled();
  });
});
