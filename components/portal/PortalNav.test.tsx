import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ path: "/portal/projects/abc" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/portal/LogoutButton", () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}));

import { PortalNav } from "@/components/portal/PortalNav";

describe("PortalNav", () => {
  afterEach(() => cleanup());

  it("marks only the active link with aria-current=page", () => {
    nav.path = "/portal/projects/abc";
    render(<PortalNav isAdmin={false} />);
    expect(screen.getByLabelText("Projects").getAttribute("aria-current")).toBe("page");
    expect(screen.getByLabelText("Dashboard").getAttribute("aria-current")).toBeNull();
    expect(screen.getByLabelText("Files").getAttribute("aria-current")).toBeNull();
  });

  it("marks Dashboard only on exactly /portal", () => {
    nav.path = "/portal";
    render(<PortalNav isAdmin={false} />);
    expect(screen.getByLabelText("Dashboard").getAttribute("aria-current")).toBe("page");
    expect(screen.getByLabelText("Projects").getAttribute("aria-current")).toBeNull();
  });

  it("renders logout and gates the admin link", () => {
    nav.path = "/portal";
    const { unmount } = render(<PortalNav isAdmin={false} />);
    expect(screen.getByText("Log out")).toBeTruthy();
    expect(screen.queryByLabelText("Admin panel")).toBeNull();
    unmount();
    render(<PortalNav isAdmin />);
    expect(screen.getByLabelText("Admin panel")).toBeTruthy();
  });
});
