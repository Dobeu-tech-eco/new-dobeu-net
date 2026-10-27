import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const openSpy = vi.fn();

vi.mock("./LightboxProvider", () => ({
  useLightbox: () => ({ open: openSpy, close: vi.fn() }),
}));
vi.mock("./ExperienceProvider", () => ({
  useExperience: () => ({ stopped: false, reduced: false, toggleMotion: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { SiteNav } from "./SiteNav";

describe("SiteNav opener wiring", () => {
  afterEach(() => {
    cleanup();
    openSpy.mockClear();
  });

  it("passes the More trigger as returnFocusTo for Paid project intake", async () => {
    render(<SiteNav />);
    const more = screen.getByRole("button", { name: /More/ });
    more.focus();
    fireEvent.keyDown(more, { key: "Enter" });

    fireEvent.click(await screen.findByRole("menuitem", { name: "Paid project intake" }));

    expect(openSpy).toHaveBeenCalledWith("intake", more);
  });

  it.each(["Explore a collaboration", "Meet Jeremy", "Paid project intake"])(
    "passes the mobile toggle as returnFocusTo for %s in the mobile menu",
    (label) => {
      render(<SiteNav />);
      const toggle = screen.getByRole("button", { name: "Open menu" });
      fireEvent.click(toggle);
      const nav = screen.getByRole("navigation", { name: "Mobile navigation" });

      fireEvent.click(within(nav).getByRole("button", { name: new RegExp(label) }));

      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][1]).toBe(toggle);
    },
  );
});
