import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";
import { OperationsContact } from "./OperationsHome";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";

const state = vi.hoisted(() => ({
  open: vi.fn(),
  toggleMotion: vi.fn(),
  reduced: false,
  pathname: "/",
}));
vi.mock("./LightboxProvider", () => ({
  useLightbox: () => ({ open: state.open }),
}));
vi.mock("./AnimatedSphere", () => ({ AnimatedSphere: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("./ExperienceProvider", () => ({
  Reveal: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  useExperience: () => ({
    stopped: true,
    reduced: state.reduced,
    toggleMotion: state.toggleMotion,
  }),
}));

beforeEach(() => {
  state.open.mockReset();
  state.toggleMotion.mockReset();
  state.reduced = false;
  state.pathname = "/";
});
afterEach(cleanup);

describe("adopted landing routing", () => {
  it("routes the primary hero action to review-first intake", () => {
    render(<Hero />);
    fireEvent.click(screen.getByTestId("hero-estimate-cta"));
    expect(state.open).toHaveBeenCalledWith("intake");
    expect(state.open).not.toHaveBeenCalledWith("form");
    expect(
      screen.getByRole("link", { name: /see what that looks like/i }),
    ).toHaveAttribute("href", "#routeready");
  });

  it("keeps intake, booking, and direct email as distinct contact paths", () => {
    render(
      <OperationsContact
        heading={<h2 id="contact-heading">Let&apos;s work out what would.</h2>}
      />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Let's work out what would.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /tell us about your operation/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /prefer to talk it through/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /or send a note/i }));
    expect(state.open.mock.calls.map(([tab]) => tab)).toEqual([
      "intake",
      "book",
      "email",
    ]);
  });

  it("hydrates the server-provided contact headline and keeps intake interactive", async () => {
    const app = (
      <OperationsContact
        heading={
          <h2 id="contact-heading" className="section-heading max-w-4xl">
            You know what&apos;s not working.
            <br />
            <span className="text-primary">Let&apos;s work out what would.</span>
          </h2>
        }
      />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(app);
    document.body.append(container);
    const serverHeading = container.querySelector("#contact-heading");
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, app, { onRecoverableError });
      });
      expect(container.querySelector("#contact-heading")).toBe(serverHeading);
      expect(serverHeading?.querySelector("span")).toHaveTextContent(
        "Let's work out what would.",
      );
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      fireEvent.click(
        within(container).getByRole("button", { name: /tell us about your operation/i }),
      );
      expect(state.open).toHaveBeenCalledWith("intake");
    } finally {
      act(() => root?.unmount());
      container.remove();
      consoleError.mockRestore();
    }
  });

  it("keeps Play enabled when reduced motion is requested", () => {
    state.reduced = true;
    render(<SiteNav />);
    const play = screen.getByRole("button", { name: "Resume animations" });
    expect(play).toBeEnabled();
    expect(play).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(play);
    expect(state.toggleMotion).toHaveBeenCalledOnce();
  });

  it("uses root-safe section links on the homepage", () => {
    render(<SiteNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(nav).getByRole("link", { name: "RouteReady" }),
    ).toHaveAttribute("href", "/#routeready");
    expect(
      within(nav).getByRole("link", { name: "Your operation" }),
    ).toHaveAttribute("href", "/#work");
    expect(within(nav).getByRole("link", { name: "Services" })).toHaveAttribute(
      "href",
      "/services",
    );
  });

  it("preserves standalone commercial-page destinations", () => {
    state.pathname = "/pricing";
    render(<SiteNav />);
    expect(screen.getByRole("link", { name: "Process" })).toHaveAttribute(
      "href",
      "/process",
    );
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/#faq",
    );
  });

  it("closes the mobile menu on Escape and restores trigger focus", () => {
    render(<SiteNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
    expect(document.body).not.toHaveClass("mobile-nav-open");
  });

  it("keeps contact, account, legal, and root anchors in the footer", () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole("link", { name: "jeremyw@dobeu.net" }),
    ).toHaveAttribute("href", "mailto:jeremyw@dobeu.net");
    expect(
      screen.getByRole("link", { name: "(848) 318-7664" }),
    ).toHaveAttribute("href", "tel:+18483187664");
    expect(screen.getByRole("link", { name: "Client portal" })).toHaveAttribute(
      "href",
      "/portal",
    );
    expect(screen.getByRole("link", { name: "RouteReady" })).toHaveAttribute(
      "href",
      "/#routeready",
    );
    expect(screen.getAllByRole("link", { name: "Privacy" })[0]).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
