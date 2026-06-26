import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the browser SDKs so we never load the real Datadog packages or make
// network calls. The mocks let us assert guard behaviour.
const { rumMock, logsMock } = vi.hoisted(() => {
  return {
    rumMock: {
      init: vi.fn(),
      setUser: vi.fn(),
      addAction: vi.fn(),
      addError: vi.fn()
    },
    logsMock: {
      init: vi.fn(),
      setUser: vi.fn()
    }
  };
});

vi.mock("@datadog/browser-rum", () => ({ datadogRum: rumMock }));
vi.mock("@datadog/browser-logs", () => ({ datadogLogs: logsMock }));

const APP_ID = "NEXT_PUBLIC_DATADOG_APPLICATION_ID";
const TOKEN = "NEXT_PUBLIC_DATADOG_CLIENT_TOKEN";

function clearEnv() {
  delete process.env[APP_ID];
  delete process.env[TOKEN];
  delete process.env.NEXT_PUBLIC_DATADOG_SITE;
  delete process.env.NEXT_PUBLIC_DATADOG_SERVICE;
  delete process.env.NEXT_PUBLIC_DATADOG_ENV;
  delete process.env.NEXT_PUBLIC_DATADOG_VERSION;
}

function setConfigured() {
  process.env[APP_ID] = "app-123";
  process.env[TOKEN] = "token-456";
}

// Each import gets a fresh module so the module-level `initialized` flag resets.
async function freshImport() {
  vi.resetModules();
  return import("@/lib/datadog");
}

beforeEach(() => {
  clearEnv();
  rumMock.init.mockClear();
  rumMock.setUser.mockClear();
  rumMock.addAction.mockClear();
  rumMock.addError.mockClear();
  logsMock.init.mockClear();
  logsMock.setUser.mockClear();
});

afterEach(() => {
  clearEnv();
});

describe("isDatadogConfigured", () => {
  it("returns false when app id or client token are absent", async () => {
    const { isDatadogConfigured } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    expect(isDatadogConfigured()).toBe(false);
  });

  it("returns false when only the application id is present", async () => {
    process.env[APP_ID] = "app-123";
    const { isDatadogConfigured } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    expect(isDatadogConfigured()).toBe(false);
  });

  it("returns false when only the client token is present", async () => {
    process.env[TOKEN] = "token-456";
    const { isDatadogConfigured } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    expect(isDatadogConfigured()).toBe(false);
  });

  it("returns true when both required vars are present", async () => {
    setConfigured();
    const { isDatadogConfigured } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    expect(isDatadogConfigured()).toBe(true);
  });
});

describe("initDatadog", () => {
  it("initializes both RUM and Logs SDKs when configured", async () => {
    setConfigured();
    const { initDatadog } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledTimes(1);
    expect(logsMock.init).toHaveBeenCalledTimes(1);
  });

  it("passes default site/service when env overrides are absent", async () => {
    setConfigured();
    const { initDatadog } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-123",
        clientToken: "token-456",
        site: "datadoghq.com",
        service: "dobeu-net"
      })
    );
  });

  it("does not initialize when not configured", async () => {
    const { initDatadog } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    await initDatadog();
    expect(rumMock.init).not.toHaveBeenCalled();
    expect(logsMock.init).not.toHaveBeenCalled();
  });

  it("is idempotent — second call does not re-init", async () => {
    setConfigured();
    const { initDatadog } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    await initDatadog();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledTimes(1);
    expect(logsMock.init).toHaveBeenCalledTimes(1);
  });
});

describe("ddIdentify", () => {
  it("no-ops when Datadog has not been initialized", async () => {
    const { ddIdentify } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    ddIdentify({ id: "u1", email: "a@b.com" });
    expect(rumMock.setUser).not.toHaveBeenCalled();
    expect(logsMock.setUser).not.toHaveBeenCalled();
  });

  it("sets the user on both SDKs after initialization", async () => {
    setConfigured();
    const { initDatadog, ddIdentify } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    await initDatadog();
    ddIdentify({ id: "u1", email: "a@b.com", name: "Tester" });
    expect(rumMock.setUser).toHaveBeenCalledWith({ id: "u1", email: "a@b.com", name: "Tester" });
    expect(logsMock.setUser).toHaveBeenCalledWith({ id: "u1", email: "a@b.com", name: "Tester" });
  });
});

describe("ddAction", () => {
  it("no-ops when not initialized", async () => {
    const { ddAction } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    ddAction("booking_scheduled");
    expect(rumMock.addAction).not.toHaveBeenCalled();
  });

  it("forwards name and context after initialization", async () => {
    setConfigured();
    const { initDatadog, ddAction } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    await initDatadog();
    ddAction("booking_scheduled", { plan: "pro" });
    expect(rumMock.addAction).toHaveBeenCalledWith("booking_scheduled", { plan: "pro" });
  });

  it("defaults context to an empty object", async () => {
    setConfigured();
    const { initDatadog, ddAction } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    await initDatadog();
    ddAction("evt");
    expect(rumMock.addAction).toHaveBeenCalledWith("evt", {});
  });
});

describe("ddError", () => {
  it("no-ops when not initialized", async () => {
    const { ddError } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    ddError(new Error("boom"));
    expect(rumMock.addError).not.toHaveBeenCalled();
  });

  it("passes through an Error instance unchanged", async () => {
    setConfigured();
    const { initDatadog, ddError } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    await initDatadog();
    const err = new Error("boom");
    ddError(err, { scope: "checkout" });
    expect(rumMock.addError).toHaveBeenCalledWith(err, { scope: "checkout" });
  });

  it("wraps a non-Error value in an Error", async () => {
    setConfigured();
    const { initDatadog, ddError } = await freshImport();
    await new Promise(r => setTimeout(r, 0));
    await initDatadog();
    ddError("string failure");
    const [errArg] = rumMock.addError.mock.calls[0];
    expect(errArg).toBeInstanceOf(Error);
    expect((errArg as Error).message).toBe("string failure");
  });
});
