import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { DeferredToaster } from "./DeferredToaster";

const toasterSection = () => document.querySelector("section[aria-label^='Notifications']");

describe("DeferredToaster", () => {
  beforeEach(() => {
    pathname.current = "/";
    // jsdom lacks matchMedia; sonner reads it for the system theme.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  afterEach(cleanup);

  it("does not mount the Toaster on marketing pages until the first interaction", async () => {
    render(<DeferredToaster />);
    expect(toasterSection()).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    await waitFor(() => expect(toasterSection()).not.toBeNull());
  });

  it("mounts the Toaster eagerly on app routes that toast on load", async () => {
    pathname.current = "/login";
    render(<DeferredToaster />);
    await waitFor(() => expect(toasterSection()).not.toBeNull());
  });
});
