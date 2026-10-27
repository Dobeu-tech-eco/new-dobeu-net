import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmLeadButton } from "./ConfirmLeadButton";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ track }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  track.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function click() {
  fireEvent.click(screen.getByRole("button", { name: "Confirm and send" }));
}

describe("ConfirmLeadButton", () => {
  it("does not call the API on render", () => {
    render(<ConfirmLeadButton token="abc" />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm and send" })).toBeEnabled();
  });

  it("strips the token from the address bar on mount without fetching", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    render(<ConfirmLeadButton token="abc" />);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBeNull();
    expect(spy.mock.calls[0][2]).toBe(window.location.pathname);
    expect(fetchMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("posts the token and shows success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, source: "form", has_message: true }),
    });
    render(<ConfirmLeadButton token="abc" />);
    click();
    await screen.findByText(/your message is on its way/);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/lead/confirm");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "abc" });
    expect(screen.queryByRole("button")).toBeNull();
    expect(track).toHaveBeenCalledWith("lead_captured", {
      source: "form",
      has_message: true,
      confirmed: true,
    });
  });

  it("shows the expired state with a link back to the form", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, error: "expired" }),
    });
    render(<ConfirmLeadButton token="abc" />);
    click();
    await screen.findByText(/This link has expired/);
    expect(track).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "send the form again" })).toHaveAttribute(
      "href",
      "/#contact",
    );
  });

  it("shows the invalid state", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, error: "invalid" }),
    });
    render(<ConfirmLeadButton token="abc" />);
    click();
    await screen.findByText(/isn.t valid/);
  });

  it("offers a retry after a server or network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<ConfirmLeadButton token="abc" />);
    click();
    await screen.findByText(/Something went wrong/);
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await screen.findByText(/your message is on its way/);
  });

  it.each([
    [409, "in_progress", /Still sending/],
    [429, undefined, /Too many attempts/],
  ])("shows a retryable state for %i", async (status, error, text) => {
    fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({ ok: false, error }) });
    render(<ConfirmLeadButton token="abc" />);
    click();
    await screen.findByText(text);
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
