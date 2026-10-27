import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MfaEnroll } from "./MfaEnroll";

const { mfa, refresh, toastSuccess, toastError } = vi.hoisted(() => ({
  mfa: { enroll: vi.fn(), challenge: vi.fn(), verify: vi.fn() },
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { mfa } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

beforeEach(() => {
  vi.resetAllMocks();
  mfa.enroll.mockResolvedValue({
    data: { id: "f1", totp: { qr_code: "data:image/svg+xml;base64,QR", secret: "SECRET123" } },
    error: null,
  });
  mfa.challenge.mockResolvedValue({ data: { id: "c1" }, error: null });
  mfa.verify.mockResolvedValue({ data: {}, error: null });
});

afterEach(cleanup);

async function startAndType(code: string) {
  fireEvent.click(screen.getByRole("button", { name: /enable two-factor/i }));
  await screen.findByAltText("TOTP enrollment QR code");
  fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: code } });
}

describe("MfaEnroll", () => {
  it("shows the QR code and manual secret after enrolling", async () => {
    render(<MfaEnroll />);
    await startAndType("");
    expect(screen.getByAltText("TOTP enrollment QR code")).toHaveAttribute(
      "src",
      "data:image/svg+xml;base64,QR",
    );
    expect(screen.getByText("SECRET123")).toBeTruthy();
  });

  it("verifies a valid code, reports success, and refreshes", async () => {
    const onEnrolled = vi.fn();
    render(<MfaEnroll onEnrolled={onEnrolled} />);
    await startAndType("123456");
    fireEvent.click(screen.getByRole("button", { name: /verify & enable/i }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(mfa.challenge).toHaveBeenCalledWith({ factorId: "f1" });
    expect(mfa.verify).toHaveBeenCalledWith({ factorId: "f1", challengeId: "c1", code: "123456" });
    expect(onEnrolled).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByAltText("TOTP enrollment QR code")).toBeNull();
  });

  it("shows an error and does not mark success on an invalid code", async () => {
    mfa.verify.mockResolvedValue({ data: null, error: { message: "bad" } });
    const onEnrolled = vi.fn();
    render(<MfaEnroll onEnrolled={onEnrolled} />);
    await startAndType("000000");
    fireEvent.click(screen.getByRole("button", { name: /verify & enable/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Invalid code. Try again."));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onEnrolled).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByLabelText("6-digit code")).toHaveValue("");
  });

  it("surfaces an enroll API error and stays on the start button", async () => {
    mfa.enroll.mockResolvedValue({ data: null, error: { message: "enroll boom" } });
    render(<MfaEnroll />);
    fireEvent.click(screen.getByRole("button", { name: /enable two-factor/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("enroll boom"));
    expect(screen.queryByAltText("TOTP enrollment QR code")).toBeNull();
  });

  it("surfaces a challenge error and does not verify or mark success", async () => {
    mfa.challenge.mockResolvedValue({ data: null, error: { message: "challenge boom" } });
    const onEnrolled = vi.fn();
    render(<MfaEnroll onEnrolled={onEnrolled} />);
    await startAndType("123456");
    fireEvent.click(screen.getByRole("button", { name: /verify & enable/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("challenge boom"));
    expect(mfa.verify).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onEnrolled).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a fallback error when challenge returns no data", async () => {
    mfa.challenge.mockResolvedValue({ data: null, error: null });
    render(<MfaEnroll />);
    await startAndType("123456");
    fireEvent.click(screen.getByRole("button", { name: /verify & enable/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Could not start challenge."));
    expect(mfa.verify).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
