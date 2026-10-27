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
  it("keeps fields and labels distinct when two forms share a source", () => {
    const { container } = render(<><LeadForm source="form" /><LeadForm source="form" /></>);
    const fields = Array.from(container.querySelectorAll("input, textarea"));
    const ids = fields.map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const form of container.querySelectorAll("form")) {
      for (const label of form.querySelectorAll("label")) {
        expect(form.contains(label.control)).toBe(true);
      }
    }
  });

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
      pending: true,
    });
    expect(screen.getByText("One more step.")).toBeInTheDocument();
    expect(screen.getByText(/Nothing is sent until you do/)).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith("Check your inbox to confirm your idea.");
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.hp_ref).toBe("");
    expect(Number.isInteger(sent.elapsed_ms)).toBe(true);
    expect(sent.elapsed_ms).toBeGreaterThanOrEqual(0);
    expect(sent).not.toHaveProperty("website");
    expect(track).not.toHaveBeenCalledWith("lead_captured", expect.anything());
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

  it("renders a honeypot that is hidden from assistive tech and the tab order", () => {
    const { container } = render(<LeadForm source="form" />);
    const honeypot = container.querySelector<HTMLInputElement>('input[name="hp_ref"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "new-password");
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "Leave this field empty" })).toBeNull();
  });
});
