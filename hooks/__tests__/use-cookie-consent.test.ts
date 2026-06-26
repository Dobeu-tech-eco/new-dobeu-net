import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useCookieConsent } from "../use-cookie-consent";

describe("useCookieConsent", () => {
  let originalDocumentCookie: string;
  let originalDoNotTrack: string | null;

  beforeEach(() => {
    originalDocumentCookie = document.cookie;
    originalDoNotTrack = navigator.doNotTrack;

    // Clear cookies before each test
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });

    // Clear navigator.doNotTrack
    Object.defineProperty(navigator, "doNotTrack", {
      writable: true,
      value: null,
    });

    // Clear window.doNotTrack
    Object.defineProperty(window, "doNotTrack", {
      writable: true,
      value: null,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: originalDocumentCookie,
    });
    Object.defineProperty(navigator, "doNotTrack", {
      writable: true,
      value: originalDoNotTrack,
    });
    vi.restoreAllMocks();
  });

  it("returns default state when no cookie is set", () => {
    const { result } = renderHook(() => useCookieConsent());

    expect(result.current.consent).toEqual({
      decided: false,
      analytics: false,
      support: false,
      marketing: false,
    });
  });

  it("handles valid JSON in cookie correctly", () => {
    const validState = {
      analytics: true,
      support: false,
      marketing: true,
    };
    document.cookie = `dobeu_cookie_consent=${encodeURIComponent(JSON.stringify(validState))}`;

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current.consent).toEqual({
      decided: true,
      analytics: true,
      support: false,
      marketing: true,
    });
  });

  it("handles invalid JSON in cookie gracefully", () => {
    // Set an invalid JSON string in the cookie
    document.cookie = "dobeu_cookie_consent=invalid-json-string";

    const { result } = renderHook(() => useCookieConsent());

    // Should fallback to default denied state
    expect(result.current.consent).toEqual({
      decided: false,
      analytics: false,
      support: false,
      marketing: false,
    });
  });

  it("respects navigator.doNotTrack", () => {
    Object.defineProperty(navigator, "doNotTrack", {
      writable: true,
      value: "1",
    });

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current.consent).toEqual({
      decided: true,
      analytics: false,
      support: false,
      marketing: false,
    });
    expect(result.current.isDNT).toBe(true);
  });

  it("respects window.doNotTrack", () => {
    Object.defineProperty(window, "doNotTrack", {
      writable: true,
      value: "yes",
    });

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current.consent).toEqual({
      decided: true,
      analytics: false,
      support: false,
      marketing: false,
    });
    expect(result.current.isDNT).toBe(true);
  });

  it("accepts all cookies", () => {
    const { result } = renderHook(() => useCookieConsent());

    act(() => {
      result.current.acceptAll();
    });

    expect(result.current.consent).toEqual({
      decided: true,
      analytics: true,
      support: true,
      marketing: true,
    });

    expect(document.cookie).toContain("dobeu_cookie_consent=");
    expect(document.cookie).toContain(encodeURIComponent(JSON.stringify({ analytics: true, support: true, marketing: true })));
  });

  it("declines all cookies", () => {
    const { result } = renderHook(() => useCookieConsent());

    act(() => {
      result.current.declineAll();
    });

    expect(result.current.consent).toEqual({
      decided: true,
      analytics: false,
      support: false,
      marketing: false,
    });

    expect(document.cookie).toContain("dobeu_cookie_consent=");
    expect(document.cookie).toContain(encodeURIComponent(JSON.stringify({ analytics: false, support: false, marketing: false })));
  });

  it("saves preferences correctly", () => {
    const { result } = renderHook(() => useCookieConsent());

    act(() => {
      result.current.savePreferences({
        analytics: true,
        support: false,
        marketing: true,
      });
    });

    expect(result.current.consent).toEqual({
      decided: true,
      analytics: true,
      support: false,
      marketing: true,
    });

    expect(document.cookie).toContain("dobeu_cookie_consent=");
    expect(document.cookie).toContain(encodeURIComponent(JSON.stringify({ analytics: true, support: false, marketing: true })));
  });
});
