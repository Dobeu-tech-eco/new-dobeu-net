import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const sendMock = vi.fn();
  const ResendCtor = vi.fn(function ResendMock(this: unknown) {
    return { emails: { send: sendMock } };
  });
  return { sendMock, ResendCtor };
});

vi.mock("resend", () => ({ Resend: h.ResendCtor }));

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  process.env.RESEND_FROM_EMAIL = "hello@dobeu.net";
  process.env.RESEND_REPLY_TO = "jeremyw@dobeu.net";
  const mod = await import("@/lib/resend");
  mod.__resetResendForTests();
});

describe("isResendConfigured", () => {
  it("true when RESEND_API_KEY set", async () => {
    const { isResendConfigured } = await import("@/lib/resend");
    expect(isResendConfigured()).toBe(true);
  });
  it("false when missing", async () => {
    delete process.env.RESEND_API_KEY;
    const { isResendConfigured } = await import("@/lib/resend");
    expect(isResendConfigured()).toBe(false);
  });
});

describe("sendEmail", () => {
  it("returns ok:false (without throwing) when Resend is unconfigured", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("@/lib/resend");
    const r = await sendEmail({ to: "x@y", subject: "s", html: "<p>x</p>" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/RESEND_API_KEY/);
  });

  it("forwards to Resend SDK and returns the new id", async () => {
    h.sendMock.mockResolvedValueOnce({ data: { id: "msg_1" }, error: null });
    const { sendEmail } = await import("@/lib/resend");
    const r = await sendEmail({ to: "client@x.com", subject: "hi", html: "<p>hi</p>" });
    expect(r).toEqual({ ok: true, id: "msg_1" });
    expect(h.sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Dobeu Tech Solutions <hello@dobeu.net>",
        to: ["client@x.com"],
        subject: "hi"
      })
    );
  });

  it("surfaces Resend error.message as ok:false (no throw)", async () => {
    h.sendMock.mockResolvedValueOnce({
      data: null,
      error: { message: "domain not verified" }
    });
    const { sendEmail } = await import("@/lib/resend");
    const r = await sendEmail({ to: "x@y", subject: "s", html: "<p>x</p>" });
    expect(r).toEqual({ ok: false, error: "domain not verified" });
  });

  it("catches thrown errors so the upstream action never breaks", async () => {
    h.sendMock.mockRejectedValueOnce(new Error("network glitch"));
    const { sendEmail } = await import("@/lib/resend");
    const r = await sendEmail({ to: "x@y", subject: "s", html: "<p>x</p>" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/network glitch/);
  });
});
