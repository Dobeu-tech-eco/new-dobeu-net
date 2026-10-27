import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MfaStatus } from "./MfaStatus";

const { mfa, refresh, toastSuccess, toastError } = vi.hoisted(() => ({
  mfa: { listFactors: vi.fn(), unenroll: vi.fn(), enroll: vi.fn(), challenge: vi.fn(), verify: vi.fn() },
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { mfa } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

beforeEach(() => {
  vi.resetAllMocks();
  mfa.unenroll.mockResolvedValue({ data: {}, error: null });
});

afterEach(cleanup);

describe("MfaStatus", () => {
  it("renders the enrolled state for a verified factor", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f1", status: "verified" }] } });
    render(<MfaStatus />);
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(await screen.findByText(/Enabled/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disable" })).toBeTruthy();
  });

  it("renders the enroll widget when no factor is verified", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "p", status: "unverified" }] } });
    render(<MfaStatus />);
    expect(await screen.findByRole("button", { name: /enable two-factor/i })).toBeTruthy();
    expect(screen.queryByText(/Enabled/)).toBeNull();
  });

  it("unenrolls the verified factor, reloads, and refreshes", async () => {
    mfa.listFactors
      .mockResolvedValueOnce({ data: { totp: [{ id: "f1", status: "verified" }] } })
      .mockResolvedValue({ data: { totp: [] } });
    render(<MfaStatus />);
    fireEvent.click(await screen.findByRole("button", { name: "Disable" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f1" });
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /enable two-factor/i })).toBeTruthy();
  });

  it("surfaces an unenroll error and stays enabled", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "f1", status: "verified" }] } });
    mfa.unenroll.mockResolvedValue({ data: null, error: { message: "nope" } });
    render(<MfaStatus />);
    fireEvent.click(await screen.findByRole("button", { name: "Disable" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("nope"));
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText(/Enabled/)).toBeTruthy();
  });
});
