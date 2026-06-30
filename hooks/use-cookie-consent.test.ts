import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useCookieConsent } from "./use-cookie-consent";

describe("useCookieConsent", () => {
  let originalCookie: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie") ||
                     Object.getOwnPropertyDescriptor(HTMLDocument.prototype, "cookie");

    let cookieValue = "";
    Object.defineProperty(document, "cookie", {
      get: vi.fn().mockImplementation(() => cookieValue),
      set: vi.fn().mockImplementation((val) => {
        cookieValue = val.split(";")[0] ?? "";
      }),
      configurable: true,
    });

    vi.stubGlobal("navigator", { doNotTrack: null });
    vi.stubGlobal("window", { doNotTrack: null });
  });

  afterEach(() => {
    if (originalCookie) {
      Object.defineProperty(document, "cookie", originalCookie);
    }
    vi.unstubAllGlobals();
  });

  it("should initialize with undecided state if no cookie exists", () => {
    const { result } = renderHook(() => useCookieConsent());

    expect(result.current.consent).toEqual({
      decided: false,
      analytics: false,
      support: false,
      marketing: false,
    });
  });

  it("should initialize with parsed cookie state if cookie exists", () => {
    document.cookie = `dobeu_cookie_consent=${encodeURIComponent(
      JSON.stringify({ analytics: true, support: false, marketing: true })
    )}`;

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current.consent).toEqual({
      decided: true,
      analytics: true,
      support: false,
      marketing: true,
    });
  });

  it("should handle DNT properly by declining all and setting decided to true", () => {
    vi.stubGlobal("navigator", { doNotTrack: "1" });

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current.consent).toEqual({
      decided: true,
      analytics: false,
      support: false,
      marketing: false,
    });
    expect(result.current.isDNT).toBe(true);
  });

  it("should update state and cookie when acceptAll is called", () => {
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
    expect(document.cookie).toContain("dobeu_cookie_consent");
    expect(document.cookie).toContain(encodeURIComponent(JSON.stringify({ analytics: true, support: true, marketing: true })));
  });

  it("should update state and cookie when declineAll is called", () => {
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
    expect(document.cookie).toContain("dobeu_cookie_consent");
    expect(document.cookie).toContain(encodeURIComponent(JSON.stringify({ analytics: false, support: false, marketing: false })));
  });

  it("should update state and cookie when savePreferences is called", () => {
    const { result } = renderHook(() => useCookieConsent());

    act(() => {
      result.current.savePreferences({
        analytics: true,
        support: false,
        marketing: true
      });
    });

    expect(result.current.consent).toEqual({
      decided: true,
      analytics: true,
      support: false,
      marketing: true,
    });
    expect(document.cookie).toContain("dobeu_cookie_consent");
    expect(document.cookie).toContain(encodeURIComponent(JSON.stringify({ analytics: true, support: false, marketing: true })));
  });

  it("should handle malformed JSON gracefully", () => {
    document.cookie = `dobeu_cookie_consent=invalid-json`;

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current.consent).toEqual({
      decided: false,
      analytics: false,
      support: false,
      marketing: false,
    });
  });
});
