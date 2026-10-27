import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsProvider } from "./analytics-provider";

const { pageView, pathnameMock } = vi.hoisted(() => ({
  pageView: vi.fn(),
  pathnameMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }));
vi.mock("@/lib/analytics", () => ({
  initAnalytics: vi.fn(),
  pageView,
  setAnalyticsConsent: vi.fn(),
}));
vi.mock("@/lib/datadog", () => ({ setDatadogConsent: vi.fn() }));
vi.mock("@/components/CookieBanner", () => ({ CookieBanner: () => null }));
vi.mock("@/hooks/use-cookie-consent", () => ({
  useCookieConsent: () => ({ consent: { analytics: true, marketing: false } }),
}));

beforeEach(() => pageView.mockReset());
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("AnalyticsProvider pageView", () => {
  it("never includes the query string for /lead/confirm", () => {
    pathnameMock.mockReturnValue("/lead/confirm");
    window.history.replaceState(null, "", "/lead/confirm?token=secret");
    render(<AnalyticsProvider>x</AnalyticsProvider>);
    expect(pageView).toHaveBeenCalledWith("/lead/confirm");
  });

  it("keeps the query string for other pages", () => {
    pathnameMock.mockReturnValue("/");
    window.history.replaceState(null, "", "/?utm_source=x");
    render(<AnalyticsProvider>x</AnalyticsProvider>);
    expect(pageView).toHaveBeenCalledWith("/?utm_source=x");
  });
});
