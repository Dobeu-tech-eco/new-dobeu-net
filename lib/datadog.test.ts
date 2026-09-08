import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the browser SDKs so we never load the real Datadog packages or make
// network calls. The mocks let us assert guard behaviour.
const rumMock = {
  init: vi.fn(),
  setUser: vi.fn(),
  clearUser: vi.fn(),
  addAction: vi.fn(),
  addError: vi.fn(),
  setTrackingConsent: vi.fn(),
  setGlobalContext: vi.fn(),
  addFeatureFlagEvaluation: vi.fn(),
  getSessionReplayLink: vi.fn(() => "https://app.datadoghq.com/rum/replay/x")
};
const logsMock = {
  init: vi.fn(),
  setUser: vi.fn(),
  clearUser: vi.fn(),
  setTrackingConsent: vi.fn()
};

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
  delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_DATADOG_REPLAY_SAMPLE_RATE;
  delete process.env.NEXT_PUBLIC_DATADOG_TRACE_SAMPLE_RATE;
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
  rumMock.clearUser.mockClear();
  rumMock.addAction.mockClear();
  rumMock.addError.mockClear();
  rumMock.setTrackingConsent.mockClear();
  rumMock.setGlobalContext.mockClear();
  rumMock.addFeatureFlagEvaluation.mockClear();
  logsMock.init.mockClear();
  logsMock.setUser.mockClear();
  logsMock.clearUser.mockClear();
  logsMock.setTrackingConsent.mockClear();
});

afterEach(() => {
  clearEnv();
});

describe("isDatadogConfigured", () => {
  it("returns false when app id or client token are absent", async () => {
    const { isDatadogConfigured } = await freshImport();
    expect(isDatadogConfigured()).toBe(false);
  });

  it("returns false when only the application id is present", async () => {
    process.env[APP_ID] = "app-123";
    const { isDatadogConfigured } = await freshImport();
    expect(isDatadogConfigured()).toBe(false);
  });

  it("returns false when only the client token is present", async () => {
    process.env[TOKEN] = "token-456";
    const { isDatadogConfigured } = await freshImport();
    expect(isDatadogConfigured()).toBe(false);
  });

  it("returns true when both required vars are present", async () => {
    setConfigured();
    const { isDatadogConfigured } = await freshImport();
    expect(isDatadogConfigured()).toBe(true);
  });
});

describe("initDatadog", () => {
  it("initializes both RUM and Logs SDKs when configured", async () => {
    setConfigured();
    const { initDatadog } = await freshImport();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledTimes(1);
    expect(logsMock.init).toHaveBeenCalledTimes(1);
  });

  it("passes default site/service when env overrides are absent", async () => {
    setConfigured();
    const { initDatadog } = await freshImport();
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
    await initDatadog();
    expect(rumMock.init).not.toHaveBeenCalled();
    expect(logsMock.init).not.toHaveBeenCalled();
  });

  it("is idempotent — second call does not re-init", async () => {
    setConfigured();
    const { initDatadog } = await freshImport();
    await initDatadog();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledTimes(1);
    expect(logsMock.init).toHaveBeenCalledTimes(1);
  });
});

describe("ddIdentify", () => {
  it("no-ops when Datadog has not been initialized", async () => {
    const { ddIdentify } = await freshImport();
    ddIdentify({ id: "u1", email: "a@b.com" });
    expect(rumMock.setUser).not.toHaveBeenCalled();
    expect(logsMock.setUser).not.toHaveBeenCalled();
  });

  it("sets the user on both SDKs after initialization", async () => {
    setConfigured();
    const { initDatadog, ddIdentify } = await freshImport();
    await initDatadog();
    ddIdentify({ id: "u1", email: "a@b.com", name: "Tester" });
    expect(rumMock.setUser).toHaveBeenCalledWith({ id: "u1", email: "a@b.com", name: "Tester" });
    expect(logsMock.setUser).toHaveBeenCalledWith({ id: "u1", email: "a@b.com", name: "Tester" });
  });
});

describe("ddAction", () => {
  it("no-ops when not initialized", async () => {
    const { ddAction } = await freshImport();
    ddAction("booking_scheduled");
    expect(rumMock.addAction).not.toHaveBeenCalled();
  });

  it("forwards name and context after initialization", async () => {
    setConfigured();
    const { initDatadog, ddAction } = await freshImport();
    await initDatadog();
    ddAction("booking_scheduled", { plan: "pro" });
    expect(rumMock.addAction).toHaveBeenCalledWith("booking_scheduled", { plan: "pro" });
  });

  it("defaults context to an empty object", async () => {
    setConfigured();
    const { initDatadog, ddAction } = await freshImport();
    await initDatadog();
    ddAction("evt");
    expect(rumMock.addAction).toHaveBeenCalledWith("evt", {});
  });
});

describe("ddError", () => {
  it("no-ops when not initialized", async () => {
    const { ddError } = await freshImport();
    ddError(new Error("boom"));
    expect(rumMock.addError).not.toHaveBeenCalled();
  });

  it("passes through an Error instance unchanged", async () => {
    setConfigured();
    const { initDatadog, ddError } = await freshImport();
    await initDatadog();
    const err = new Error("boom");
    ddError(err, { scope: "checkout" });
    expect(rumMock.addError).toHaveBeenCalledWith(err, { scope: "checkout" });
  });

  it("wraps a non-Error value in an Error", async () => {
    setConfigured();
    const { initDatadog, ddError } = await freshImport();
    await initDatadog();
    ddError("string failure");
    const [errArg] = rumMock.addError.mock.calls[0];
    expect(errArg).toBeInstanceOf(Error);
    expect((errArg as Error).message).toBe("string failure");
  });
});

describe("version + env tagging", () => {
  it("derives a short version from the Vercel commit SHA", async () => {
    setConfigured();
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = "abcdef1234567890";
    const { initDatadog } = await freshImport();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledWith(
      expect.objectContaining({ version: "abcdef1" })
    );
  });

  it("prefers an explicit NEXT_PUBLIC_DATADOG_VERSION over the SHA", async () => {
    setConfigured();
    process.env.NEXT_PUBLIC_DATADOG_VERSION = "2.0.0";
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = "abcdef1234567890";
    const { initDatadog } = await freshImport();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledWith(expect.objectContaining({ version: "2.0.0" }));
  });

  it("does not truncate an explicit version longer than 7 characters", async () => {
    setConfigured();
    process.env.NEXT_PUBLIC_DATADOG_VERSION = "release-2026-08-29";
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = "abcdef1234567890";
    const { initDatadog } = await freshImport();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledWith(
      expect.objectContaining({ version: "release-2026-08-29" })
    );
  });

  it("falls back to NEXT_PUBLIC_VERCEL_ENV for env", async () => {
    setConfigured();
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    const { initDatadog } = await freshImport();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledWith(expect.objectContaining({ env: "preview" }));
  });
});

describe("sampling", () => {
  it("disables session replay outside production by default", async () => {
    setConfigured();
    process.env.NEXT_PUBLIC_DATADOG_ENV = "preview";
    const { initDatadog } = await freshImport();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledWith(
      expect.objectContaining({ sessionReplaySampleRate: 0, sessionSampleRate: 100 })
    );
  });

  it("samples 20% of sessions for replay in production by default", async () => {
    setConfigured();
    process.env.NEXT_PUBLIC_DATADOG_ENV = "production";
    const { initDatadog } = await freshImport();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledWith(
      expect.objectContaining({ sessionReplaySampleRate: 20 })
    );
  });

  it("honours an explicit replay sample rate", async () => {
    setConfigured();
    process.env.NEXT_PUBLIC_DATADOG_REPLAY_SAMPLE_RATE = "5";
    const { initDatadog } = await freshImport();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledWith(
      expect.objectContaining({ sessionReplaySampleRate: 5 })
    );
  });

  it("ignores an out-of-range sample rate and uses the default", async () => {
    setConfigured();
    process.env.NEXT_PUBLIC_DATADOG_ENV = "production";
    process.env.NEXT_PUBLIC_DATADOG_REPLAY_SAMPLE_RATE = "900";
    const { initDatadog } = await freshImport();
    await initDatadog();
    expect(rumMock.init).toHaveBeenCalledWith(
      expect.objectContaining({ sessionReplaySampleRate: 20 })
    );
  });
});

describe("redactUrl", () => {
  it("redacts sensitive query parameters", async () => {
    const { redactUrl } = await freshImport();
    expect(redactUrl("https://dobeu.net/login?email=a@b.com&next=/portal")).toBe(
      "https://dobeu.net/login?email=REDACTED&next=%2Fportal"
    );
  });

  it("redacts PKCE codes on relative auth-callback paths", async () => {
    const { redactUrl } = await freshImport();
    expect(redactUrl("/auth/callback?code=pkce-secret&next=/portal")).toBe(
      "/auth/callback?code=REDACTED&next=%2Fportal"
    );
  });

  it("redacts http.url on a server log context without mutating the input", async () => {
    const { redactLogContext } = await import("@/lib/datadog-redact");
    const context = {
      http: { url: "/auth/callback?code=pkce-secret", method: "GET" },
      nextjs: { routePath: "/auth/callback" }
    };
    const redacted = redactLogContext(context);
    expect(redacted.http).toEqual({ url: "/auth/callback?code=REDACTED", method: "GET" });
    expect(context.http.url).toBe("/auth/callback?code=pkce-secret");
  });

  it("leaves clean URLs untouched", async () => {
    const { redactUrl } = await freshImport();
    const url = "https://dobeu.net/pricing?ref=blog";
    expect(redactUrl(url)).toBe(url);
  });

  it("returns the input unchanged when it is not a URL", async () => {
    const { redactUrl } = await freshImport();
    expect(redactUrl(undefined)).toBeUndefined();
  });
});

describe("isIgnoredError", () => {
  it("ignores ResizeObserver loop noise", async () => {
    const { isIgnoredError } = await freshImport();
    expect(isIgnoredError("ResizeObserver loop limit exceeded")).toBe(true);
  });

  it("ignores browser-extension stack frames", async () => {
    const { isIgnoredError } = await freshImport();
    expect(isIgnoredError("chrome-extension://abc/inject.js failed")).toBe(true);
  });

  it("keeps real application errors", async () => {
    const { isIgnoredError } = await freshImport();
    expect(isIgnoredError("Cannot read properties of undefined")).toBe(false);
  });

  it("treats an absent message as not ignored", async () => {
    const { isIgnoredError } = await freshImport();
    expect(isIgnoredError(undefined)).toBe(false);
  });
});

describe("setDatadogConsent", () => {
  it("initializes and grants consent when accepted", async () => {
    setConfigured();
    const { setDatadogConsent } = await freshImport();
    await setDatadogConsent(true);
    expect(rumMock.init).toHaveBeenCalledTimes(1);
    expect(rumMock.setTrackingConsent).toHaveBeenCalledWith("granted");
    expect(logsMock.setTrackingConsent).toHaveBeenCalledWith("granted");
  });

  it("never loads the SDK when consent is withheld", async () => {
    setConfigured();
    const { setDatadogConsent } = await freshImport();
    await setDatadogConsent(false);
    expect(rumMock.init).not.toHaveBeenCalled();
    expect(rumMock.setTrackingConsent).not.toHaveBeenCalled();
  });

  it("withdraws consent and clears the user after a prior grant", async () => {
    setConfigured();
    const { setDatadogConsent } = await freshImport();
    await setDatadogConsent(true);
    rumMock.setTrackingConsent.mockClear();
    rumMock.clearUser.mockClear();
    logsMock.clearUser.mockClear();
    await setDatadogConsent(false);
    expect(rumMock.setTrackingConsent).toHaveBeenCalledWith("not-granted");
    expect(logsMock.setTrackingConsent).toHaveBeenCalledWith("not-granted");
    expect(rumMock.clearUser).toHaveBeenCalled();
    expect(logsMock.clearUser).toHaveBeenCalled();
  });

  it("does not leave tracking granted if consent is withdrawn during init", async () => {
    setConfigured();
    const { setDatadogConsent } = await freshImport();
    const grant = setDatadogConsent(true);
    await setDatadogConsent(false);
    await grant;
    const lastRumConsent = rumMock.setTrackingConsent.mock.calls.at(-1)?.[0];
    expect(lastRumConsent).not.toBe("granted");
    if (rumMock.init.mock.calls.length > 0) {
      expect(lastRumConsent).toBe("not-granted");
      expect(logsMock.clearUser).toHaveBeenCalled();
    }
  });
});

describe("ddFeatureFlag / ddSetGlobalContext / ddClearUser", () => {
  it("no-op before initialization", async () => {
    const { ddFeatureFlag, ddSetGlobalContext } = await freshImport();
    ddFeatureFlag("new_pricing", true);
    ddSetGlobalContext({ tier: "pro" });
    expect(rumMock.addFeatureFlagEvaluation).not.toHaveBeenCalled();
    expect(rumMock.setGlobalContext).not.toHaveBeenCalled();
  });

  it("forwards to the SDK after initialization", async () => {
    setConfigured();
    const { initDatadog, ddFeatureFlag, ddSetGlobalContext, ddClearUser } =
      await freshImport();
    await initDatadog();
    ddFeatureFlag("new_pricing", true);
    ddSetGlobalContext({ tier: "pro" });
    ddClearUser();
    expect(rumMock.addFeatureFlagEvaluation).toHaveBeenCalledWith("new_pricing", true);
    expect(rumMock.setGlobalContext).toHaveBeenCalledWith({ tier: "pro" });
    expect(rumMock.clearUser).toHaveBeenCalled();
    expect(logsMock.clearUser).toHaveBeenCalled();
  });
});

describe("tracing configuration", () => {
  it("only injects tracing headers on the app's own origin", async () => {
    setConfigured();
    const { initDatadog } = await freshImport();
    await initDatadog();
    const config = rumMock.init.mock.calls[0][0] as {
      allowedTracingUrls: Array<{ match: (url: string) => boolean; propagatorTypes: string[] }>;
    };
    const rule = config.allowedTracingUrls[0];
    expect(rule.propagatorTypes).toEqual(["tracecontext", "datadog"]);
    expect(rule.match(`${window.location.origin}/api/lead`)).toBe(true);
    expect(rule.match("https://api.stripe.com/v1/charges")).toBe(false);
  });
});
