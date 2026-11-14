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
import { OperationsContact, ProductShowcase } from "./OperationsHome";
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
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("adopted landing routing", () => {
  it("leads with usable business technology and links to the real products", () => {
    render(
      <>
        <Hero />
        <ProductShowcase />
      </>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "We build usable business technology.",
    );
    for (const [name, href] of [
      ["RouteReady", "https://routereadyhq.com"],
      ["Chima Comics", "https://chimacomics.shop"],
      ["Dobeu.space", "https://dobeu.space"],
      ["Ikram & Co.", "https://www.dobeu.store/en"],
    ]) {
      expect(
        screen.getByRole("link", {
          name: `Explore ${name} (opens in new tab)`,
        }),
      ).toHaveAttribute("href", href);
    }
  });

  it("routes the primary hero action to a personal collaboration form", () => {
    render(<Hero />);
    fireEvent.click(screen.getByTestId("hero-estimate-cta"));
    expect(state.open).toHaveBeenCalledWith("form");
    expect(state.open).not.toHaveBeenCalledWith("intake");
    expect(
      screen.getByRole("link", { name: /see what that looks like/i }),
    ).toHaveAttribute("href", "#routeready");
  });

  it("keeps collaboration, booking, and direct email as distinct contact paths", () => {
    render(
      <OperationsContact
        heading={<h2 id="contact-heading">Let&apos;s work out what would.</h2>}
      />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "Let's work out what would.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /explore a collaboration/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /prefer to meet/i }));
    fireEvent.click(screen.getByRole("button", { name: /or send a note/i }));
    expect(state.open.mock.calls.map(([tab]) => tab)).toEqual([
      "form",
      "book",
      "email",
    ]);
  });

  it("hydrates the server-provided contact headline and keeps collaboration interactive", async () => {
    const app = (
      <OperationsContact
        heading={
          <h2 id="contact-heading" className="section-heading max-w-4xl">
            You know what&apos;s not working.
            <br />
            <span className="text-primary">
              Let&apos;s work out what would.
            </span>
          </h2>
        }
      />
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(app);
    document.body.append(container);
    const serverHeading = container.querySelector("#contact-heading");
    const onRecoverableError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
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
        within(container).getByRole("button", {
          name: /explore a collaboration/i,
        }),
      );
      expect(state.open).toHaveBeenCalledWith("form");
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
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/#products",
    );
    expect(within(nav).getByRole("link", { name: "About Jeremy" })).toHaveAttribute(
      "href",
      "/about",
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
      "/faq",
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

  describe("satellite discovery links in the footer", () => {
    const TUTOR = "NEXT_PUBLIC_SATELLITE_TUTOR_URL";
    const STAFFING = "NEXT_PUBLIC_SATELLITE_STAFFING_URL";
    const externalHrefs = () =>
      screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href") ?? "")
        .filter((href) => /tutor|staffing/i.test(href));

    beforeEach(() => {
      vi.stubEnv(TUTOR, "");
      vi.stubEnv(STAFFING, "");
    });

    it("renders no Tutor link when the env var is unset", () => {
      vi.stubEnv(TUTOR, undefined);
      vi.stubEnv(STAFFING, undefined);
      render(<SiteFooter />);
      expect(screen.queryByRole("link", { name: "Tutor" })).toBeNull();
      expect(externalHrefs()).toEqual([]);
    });

    it.each([
      ["http scheme", "http://tutor.dobeu.net"],
      ["wrong host", "https://tutor.example.com"],
      ["lookalike host", "https://tutor.dobeu.net.example.com"],
      ["path", "https://tutor.dobeu.net/learn"],
      ["explicit :443", "https://tutor.dobeu.net:443"],
      ["credentials", "https://user:pass@tutor.dobeu.net"],
      ["query string", "https://tutor.dobeu.net/?next=/x"],
      ["empty string", ""],
    ])("renders no Tutor link for an invalid value (%s)", (_name, value) => {
      vi.stubEnv(TUTOR, value);
      render(<SiteFooter />);
      expect(screen.queryByRole("link", { name: "Tutor" })).toBeNull();
      expect(externalHrefs()).toEqual([]);
    });

    it.each([["https://tutor.dobeu.net"], ["https://tutor.dobeu.net/"]])(
      "links Tutor to the exact validated origin for %s",
      (value) => {
        vi.stubEnv(TUTOR, value);
        render(<SiteFooter />);
        const link = screen.getByRole("link", { name: "Tutor" });
        expect(link).toHaveAttribute("href", "https://tutor.dobeu.net");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(
          within(
            screen.getByRole("navigation", { name: "Footer navigation" }),
          ).getAllByRole("link", { name: "Tutor" }),
        ).toHaveLength(1);
      },
    );

    it("never renders a staffing link, whatever the staffing env var holds", () => {
      vi.stubEnv(TUTOR, "https://tutor.dobeu.net");
      vi.stubEnv(STAFFING, "https://staffing.dobeu.net");
      render(<SiteFooter />);
      expect(screen.queryByRole("link", { name: /staffing/i })).toBeNull();
      expect(externalHrefs()).toEqual(["https://tutor.dobeu.net"]);
    });
  });
});
