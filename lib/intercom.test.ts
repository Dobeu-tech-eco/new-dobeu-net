import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the Intercom messenger SDK. Default export is the boot function;
// named exports are update/shutdown.
const bootMock = vi.fn();
const updateMock = vi.fn();
const shutdownMock = vi.fn();

vi.mock("@intercom/messenger-js-sdk", () => ({
  default: bootMock,
  update: updateMock,
  shutdown: shutdownMock,
}));

const APP_ID = "NEXT_PUBLIC_INTERCOM_APP_ID";

// Fresh module per import so the module-level `booted` flag resets.
async function freshImport() {
  vi.resetModules();
  return import("@/lib/intercom");
}

beforeEach(() => {
  delete process.env[APP_ID];
  bootMock.mockClear();
  updateMock.mockClear();
  shutdownMock.mockClear();
});

afterEach(() => {
  delete process.env[APP_ID];
});

describe("isIntercomConfigured", () => {
  it("returns false when app id is absent", async () => {
    const { isIntercomConfigured } = await freshImport();
    expect(isIntercomConfigured()).toBe(false);
  });

  it("returns false when app id is an empty string", async () => {
    process.env[APP_ID] = "";
    const { isIntercomConfigured } = await freshImport();
    expect(isIntercomConfigured()).toBe(false);
  });

  it("returns true when app id is present", async () => {
    process.env[APP_ID] = "abc123";
    const { isIntercomConfigured } = await freshImport();
    expect(isIntercomConfigured()).toBe(true);
  });
});

describe("initIntercom", () => {
  it("boots with the app id when configured", async () => {
    process.env[APP_ID] = "abc123";
    const { initIntercom } = await freshImport();
    initIntercom();
    expect(bootMock).toHaveBeenCalledWith({ app_id: "abc123" });
  });

  it("does not boot when app id is absent", async () => {
    const { initIntercom } = await freshImport();
    initIntercom();
    expect(bootMock).not.toHaveBeenCalled();
  });

  it("is idempotent — only boots once across repeated calls", async () => {
    process.env[APP_ID] = "abc123";
    const { initIntercom } = await freshImport();
    initIntercom();
    initIntercom();
    expect(bootMock).toHaveBeenCalledTimes(1);
  });
});

describe("identifyIntercom", () => {
  it("boots first then updates when configured", async () => {
    process.env[APP_ID] = "abc123";
    const { identifyIntercom } = await freshImport();
    identifyIntercom({ user_id: "u1", email: "a@b.com", name: "Tester" });
    expect(bootMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        email: "a@b.com",
        name: "Tester",
      }),
    );
  });

  it("maps company string into an object with id and name", async () => {
    process.env[APP_ID] = "abc123";
    const { identifyIntercom } = await freshImport();
    identifyIntercom({ user_id: "u1", company: "Acme" });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ company: { id: "Acme", name: "Acme" } }),
    );
  });

  it("leaves company undefined when not provided", async () => {
    process.env[APP_ID] = "abc123";
    const { identifyIntercom } = await freshImport();
    identifyIntercom({ user_id: "u1" });
    const [payload] = updateMock.mock.calls[0];
    expect(payload.company).toBeUndefined();
  });

  it("forwards user_hash for identity verification", async () => {
    process.env[APP_ID] = "abc123";
    const { identifyIntercom } = await freshImport();
    identifyIntercom({ user_id: "u1", user_hash: "hmac-xyz" });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_hash: "hmac-xyz" }),
    );
  });

  it("still calls update even when not configured (no boot)", async () => {
    const { identifyIntercom } = await freshImport();
    identifyIntercom({ user_id: "u1" });
    expect(bootMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});

describe("shutdownIntercom", () => {
  it("no-ops when not booted", async () => {
    const { shutdownIntercom } = await freshImport();
    shutdownIntercom();
    expect(shutdownMock).not.toHaveBeenCalled();
  });

  it("shuts down after a successful boot", async () => {
    process.env[APP_ID] = "abc123";
    const { initIntercom, shutdownIntercom } = await freshImport();
    initIntercom();
    shutdownIntercom();
    expect(shutdownMock).toHaveBeenCalledTimes(1);
  });

  it("allows re-boot after shutdown resets the booted flag", async () => {
    process.env[APP_ID] = "abc123";
    const { initIntercom, shutdownIntercom } = await freshImport();
    initIntercom();
    shutdownIntercom();
    initIntercom();
    expect(bootMock).toHaveBeenCalledTimes(2);
  });
});
