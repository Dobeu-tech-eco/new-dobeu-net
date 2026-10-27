import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MfaStepUp } from "./MfaStepUp";

const { mfa, replace, refresh, toastError } = vi.hoisted(() => ({
  mfa: { listFactors: vi.fn(), challenge: vi.fn(), verify: vi.fn() },
  replace: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { mfa } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

beforeEach(() => {
  vi.resetAllMocks();
  mfa.listFactors.mockResolvedValue({
    data: { totp: [{ id: "pending", status: "unverified" }, { id: "f1", status: "verified" }] },
  });
  mfa.challenge.mockResolvedValue({ data: { id: "c1" }, error: null });
  mfa.verify.mockResolvedValue({ data: {}, error: null });
});

afterEach(cleanup);

function submitCode(code: string) {
  fireEvent.change(screen.getByLabelText("Authentication code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: /continue to admin/i }));
}

describe("MfaStepUp", () => {
  it("challenges the verified factor, verifies, then redirects and refreshes", async () => {
    render(<MfaStepUp next="/admin" />);
    submitCode("123456");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(mfa.challenge).toHaveBeenCalledWith({ factorId: "f1" });
    expect(mfa.verify).toHaveBeenCalledWith({ factorId: "f1", challengeId: "c1", code: "123456" });
    expect(refresh).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows an error and does not redirect on a wrong code", async () => {
    mfa.verify.mockResolvedValue({ data: null, error: { message: "bad" } });
    render(<MfaStepUp next="/admin" />);
    submitCode("000000");
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Invalid code. Try again."));
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Authentication code")).toHaveValue("");
  });

  it("errors when there is no verified factor", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: "p", status: "unverified" }] } });
    render(<MfaStepUp next="/admin" />);
    submitCode("123456");
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(mfa.challenge).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("surfaces a challenge error and does not verify or redirect", async () => {
    mfa.challenge.mockResolvedValue({ data: null, error: { message: "challenge boom" } });
    render(<MfaStepUp next="/admin" />);
    submitCode("123456");
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("challenge boom"));
    expect(mfa.verify).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a fallback error when challenge returns no data", async () => {
    mfa.challenge.mockResolvedValue({ data: null, error: null });
    render(<MfaStepUp next="/admin" />);
    submitCode("123456");
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Could not start challenge."));
    expect(mfa.verify).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
