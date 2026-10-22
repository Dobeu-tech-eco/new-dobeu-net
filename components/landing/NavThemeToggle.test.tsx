import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NavThemeToggle } from "./NavThemeToggle";

describe("NavThemeToggle", () => {
  afterEach(cleanup);

  it("renders the theme trigger without loading the dropdown menu", () => {
    render(<NavThemeToggle />);
    const trigger = screen.getByRole("button", { name: "Toggle theme" });
    expect(trigger).toBeInTheDocument();
    // Same accessible shape as the Radix trigger, but not the Radix trigger.
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("data-state");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("swaps in the real toggle and opens the menu when pressed before it loads", async () => {
    render(<NavThemeToggle />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    });

    // The replayed press opens the real Radix menu (which aria-hides the rest
    // of the page while open, hence `hidden: true` for the trigger lookup).
    expect(await screen.findByRole("menuitem", { name: /dark/i })).toBeInTheDocument();
    const triggers = screen.getAllByRole("button", { name: "Toggle theme", hidden: true });
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toHaveAttribute("data-state", "open");
    expect(triggers[0]).toHaveAttribute("aria-expanded", "true");
  });

  it("arms on hover without opening the menu", async () => {
    render(<NavThemeToggle />);
    await act(async () => {
      fireEvent.pointerEnter(screen.getByRole("button", { name: "Toggle theme" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Toggle theme" })).toHaveAttribute("data-state", "closed");
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
