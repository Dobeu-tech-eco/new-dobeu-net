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

  it("swaps in the real toggle silently when pressed before it loads", async () => {
    render(<NavThemeToggle />);
    await act(async () => {
      const placeholder = screen.getByRole("button", { name: "Toggle theme" });
      placeholder.focus();
      fireEvent.pointerDown(placeholder, { button: 0 });
      fireEvent.keyDown(placeholder, { key: "Enter" });
    });

    // The early press only loads the real trigger; it never auto-opens the
    // modal menu, so a late chunk cannot pull focus into it.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Toggle theme" })).toHaveAttribute("data-state", "closed");
    });
    expect(screen.getAllByRole("button", { name: "Toggle theme" })).toHaveLength(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("does not open when the pointer is still over the toggle but focus moved on", async () => {
    render(
      <>
        <NavThemeToggle />
        <button type="button">Book a call</button>
      </>,
    );
    const other = screen.getByRole("button", { name: "Book a call" });
    await act(async () => {
      const placeholder = screen.getByRole("button", { name: "Toggle theme" });
      fireEvent.pointerEnter(placeholder);
      fireEvent.pointerDown(placeholder, { button: 0 });
      other.focus();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Toggle theme" })).toHaveAttribute("data-state", "closed");
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(other);
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

  it("does not open or steal focus when the user moved on before the chunk arrived", async () => {
    render(
      <>
        <NavThemeToggle />
        <button type="button">Book a call</button>
      </>,
    );
    const other = screen.getByRole("button", { name: "Book a call" });
    await act(async () => {
      const placeholder = screen.getByRole("button", { name: "Toggle theme" });
      fireEvent.pointerEnter(placeholder);
      fireEvent.pointerDown(placeholder, { button: 0 });
      fireEvent.pointerLeave(placeholder);
      other.focus();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Toggle theme" })).toHaveAttribute("data-state", "closed");
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(other);
  });

  it("keeps keyboard focus on the trigger when the placeholder is swapped out", async () => {
    render(<NavThemeToggle />);
    await act(async () => {
      screen.getByRole("button", { name: "Toggle theme" }).focus();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Toggle theme" })).toHaveAttribute("data-state", "closed");
    });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Toggle theme" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
