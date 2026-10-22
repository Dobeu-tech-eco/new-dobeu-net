import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieBanner } from "./CookieBanner";

// jsdom has no layout: report a fixed banner height on observe().
class ResizeObserverStub {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe() {
    this.cb([{ borderBoxSize: [{ blockSize: 49, inlineSize: 400 }] } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

describe("CookieBanner offset publishing", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    document.cookie = "dobeu_cookie_consent=; max-age=0; path=/";
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("writes --cookie-banner-offset onto reader elements, never onto <html>", async () => {
    const reader = document.createElement("div");
    reader.setAttribute("style", "bottom: var(--cookie-banner-offset, 0px)");
    document.body.appendChild(reader);

    await act(async () => {
      render(<CookieBanner />);
    });

    expect(document.documentElement.style.getPropertyValue("--cookie-banner-offset")).toBe("");
    expect(reader.style.getPropertyValue("--cookie-banner-offset")).toBe("49px");
  });

  it("picks up readers that mount after the banner", async () => {
    await act(async () => {
      render(<CookieBanner />);
    });
    const late = document.createElement("section");
    late.className = "pb-[calc(5rem+var(--cookie-banner-offset,0px))]";
    await act(async () => {
      document.body.appendChild(late);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(late.style.getPropertyValue("--cookie-banner-offset")).toBe("49px");
  });
});
