import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  posthogCapture: vi.fn(),
  posthogOptOut: vi.fn(),
  posthogOptIn: vi.fn(),
  posthogIdentify: vi.fn(),
  posthogReset: vi.fn(),
  mixpanelTrack: vi.fn(),
  mixpanelOptOut: vi.fn(),
  mixpanelOptIn: vi.fn(),
  mixpanelIdentify: vi.fn(),
  mixpanelReset: vi.fn(),
  ampInitAll: vi.fn(() => Promise.resolve()),
  ampTrack: vi.fn(),
  ampSetOptOut: vi.fn(),
  ampSetUserId: vi.fn(),
  ampIdentify: vi.fn(),
  ampReset: vi.fn(),
  identifySet: vi.fn()
}));

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: h.posthogCapture,
    identify: h.posthogIdentify,
    reset: h.posthogReset,
    opt_out_capturing: h.posthogOptOut,
    opt_in_capturing: h.posthogOptIn
  }
}));

vi.mock("mixpanel-browser", () => ({
  default: {
    init: vi.fn(),
    track: h.mixpanelTrack,
    identify: h.mixpanelIdentify,
    reset: h.mixpanelReset,
    opt_out_tracking: h.mixpanelOptOut,
    opt_in_tracking: h.mixpanelOptIn,
    people: { set: vi.fn() }
  }
}));

vi.mock("@amplitude/unified", () => {
  class Identify {
    set = h.identifySet;
  }
  return {
    initAll: h.ampInitAll,
    track: h.ampTrack,
    setOptOut: h.ampSetOptOut,
    setUserId: h.ampSetUserId,
    identify: h.ampIdentify,
    reset: h.ampReset,
    Identify,
    Types: { LogLevel: { Debug: 4, Warn: 2 } }
  };
});

type AnalyticsModule = typeof import("@/lib/analytics");

const AMPLITUDE_KEY = "test-amplitude-key";

/** Fresh module instance per test — `lib/analytics.ts` holds singleton init state. */
async function loadAnalytics(): Promise<AnalyticsModule> {
  vi.resetModules();
  return import("@/lib/analytics");
}

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockClear());
  vi.unstubAllEnvs();
  // @ts-expect-error test shim
  global.window = { dataLayer: [] };
});

describe("analytics consent gating", () => {
  it("does not send events before consent", async () => {
    const analytics = await loadAnalytics();
    analytics.setAnalyticsConsent(false);
    analytics.track("lead_submitted", { source: "form" });
    expect(h.posthogCapture).not.toHaveBeenCalled();
    expect(h.mixpanelTrack).not.toHaveBeenCalled();
    expect(h.ampTrack).not.toHaveBeenCalled();
    expect(global.window.dataLayer).toEqual([]);
  });

  it("pushes events after consent is granted", async () => {
    const analytics = await loadAnalytics();
    analytics.setAnalyticsConsent(true);
    analytics.track("lead_submitted", { source: "form" });
    expect(h.posthogCapture).not.toHaveBeenCalled();
    expect(h.mixpanelTrack).not.toHaveBeenCalled();
    expect(global.window.dataLayer).toContainEqual({ event: "lead_submitted", source: "form" });
  });

  it("skips Amplitude entirely when the API key is absent", async () => {
    const analytics = await loadAnalytics();
    await analytics.initAnalytics(true);
    expect(h.ampInitAll).not.toHaveBeenCalled();
    analytics.track("cta_click");
    expect(h.ampTrack).not.toHaveBeenCalled();
  });
});

describe("amplitude fan-out", () => {
  let analytics: AnalyticsModule;

  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", AMPLITUDE_KEY);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_MIXPANEL_TOKEN", "mp_test");
    analytics = await loadAnalytics();
    await analytics.initAnalytics(true);
  });

  it("initializes once with explicit autocapture, replay and skipped engagement", async () => {
    expect(h.ampInitAll).toHaveBeenCalledTimes(1);
    expect(h.ampInitAll).toHaveBeenCalledWith(
      AMPLITUDE_KEY,
      expect.objectContaining({
        serverZone: "US",
        analytics: expect.objectContaining({
          autocapture: expect.objectContaining({ pageViews: true, networkTracking: false })
        }),
        sessionReplay: { sampleRate: 1 },
        engagement: { skip: true }
      })
    );
    await analytics.initAnalytics(true);
    expect(h.ampInitAll).toHaveBeenCalledTimes(1);
  });

  it("forwards custom events to Amplitude after consent", () => {
    analytics.track("cta_click", { cta_location: "hero" });
    expect(h.ampTrack).toHaveBeenCalledWith("cta_click", { cta_location: "hero" });
  });

  it("does not forward the synthetic $pageview (autocapture handles page views)", () => {
    analytics.pageView("/pricing");
    expect(h.ampTrack).not.toHaveBeenCalled();
    expect(global.window.dataLayer).toContainEqual({ event: "$pageview", $current_url: "/pricing" });
  });

  it("opts every SDK out when consent is withdrawn, and back in when re-granted", () => {
    analytics.setAnalyticsConsent(false);
    expect(h.ampSetOptOut).toHaveBeenCalledWith(true);
    expect(h.posthogOptOut).toHaveBeenCalled();
    expect(h.mixpanelOptOut).toHaveBeenCalled();
    analytics.track("cta_click");
    expect(h.ampTrack).not.toHaveBeenCalled();

    analytics.setAnalyticsConsent(true);
    expect(h.ampSetOptOut).toHaveBeenLastCalledWith(false);
    expect(h.posthogOptIn).toHaveBeenCalled();
    expect(h.mixpanelOptIn).toHaveBeenCalled();
  });

  it("identifies the authenticated user with user_id + properties and resets on logout", () => {
    analytics.identifyUser({ userId: "user-uuid-1234", email: "client@example.com", isAdmin: false });
    expect(h.ampSetUserId).toHaveBeenCalledWith("user-uuid-1234");
    expect(h.identifySet).toHaveBeenCalledWith("email", "client@example.com");
    expect(h.identifySet).toHaveBeenCalledWith("is_admin", false);
    expect(h.ampIdentify).toHaveBeenCalled();
    expect(h.posthogIdentify).toHaveBeenCalledWith("user-uuid-1234", { email: "client@example.com" });
    expect(h.mixpanelIdentify).toHaveBeenCalledWith("user-uuid-1234");

    analytics.resetAnalyticsUser();
    expect(h.ampReset).toHaveBeenCalled();
    expect(h.posthogReset).toHaveBeenCalled();
    expect(h.mixpanelReset).toHaveBeenCalled();
  });

  it("applies an identity supplied before the SDKs finished loading", async () => {
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", AMPLITUDE_KEY);
    const fresh = await loadAnalytics();
    fresh.identifyUser({ userId: "user-uuid-5678" });
    expect(h.ampSetUserId).not.toHaveBeenCalled();
    await fresh.initAnalytics(true);
    expect(h.ampSetUserId).toHaveBeenCalledWith("user-uuid-5678");
  });
});

describe("getAmplitudeReplaySampleRate", () => {
  it("defaults to 1 when unset or invalid", async () => {
    const { getAmplitudeReplaySampleRate } = await loadAnalytics();
    expect(getAmplitudeReplaySampleRate(undefined)).toBe(1);
    expect(getAmplitudeReplaySampleRate("")).toBe(1);
    expect(getAmplitudeReplaySampleRate("abc")).toBe(1);
  });

  it("parses and clamps to the 0–1 range", async () => {
    const { getAmplitudeReplaySampleRate } = await loadAnalytics();
    expect(getAmplitudeReplaySampleRate("0.25")).toBe(0.25);
    expect(getAmplitudeReplaySampleRate("0")).toBe(0);
    expect(getAmplitudeReplaySampleRate("5")).toBe(1);
    expect(getAmplitudeReplaySampleRate("-1")).toBe(0);
  });
});
