import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  posthogCapture: vi.fn(),
  mixpanelTrack: vi.fn()
}));

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    capture: h.posthogCapture,
    identify: vi.fn()
  }
}));

vi.mock("mixpanel-browser", () => ({
  default: {
    init: vi.fn(),
    track: h.mixpanelTrack,
    identify: vi.fn(),
    people: { set: vi.fn() }
  }
}));

import { setAnalyticsConsent, track } from "@/lib/analytics";

beforeEach(() => {
  h.posthogCapture.mockClear();
  h.mixpanelTrack.mockClear();
  // @ts-expect-error test shim
  global.window = { dataLayer: [] };
  setAnalyticsConsent(false);
});

describe("analytics consent gating", () => {
  it("does not send events before consent", () => {
    track("lead_submitted", { source: "form" });
    expect(h.posthogCapture).not.toHaveBeenCalled();
    expect(h.mixpanelTrack).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(global.window.dataLayer).toEqual([]);
  });

  it("pushes events after consent is granted", () => {
    setAnalyticsConsent(true);
    track("lead_submitted", { source: "form" });
    expect(h.posthogCapture).not.toHaveBeenCalled();
    expect(h.mixpanelTrack).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(global.window.dataLayer).toContainEqual({ event: "lead_submitted", source: "form" });
  });
});
