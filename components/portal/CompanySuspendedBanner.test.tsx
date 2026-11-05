import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CompanySuspendedBanner } from "./CompanySuspendedBanner";
import { NAP } from "@/lib/jeremy-data";

afterEach(cleanup);

describe("CompanySuspendedBanner", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(<CompanySuspendedBanner companies={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces one suspended company with fixed copy", () => {
    render(<CompanySuspendedBanner companies={[{ id: "c1", name: "Acme" }]} />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Acme is suspended. Contact Dobeu to reactivate it.");
    expect(region.className).toContain("break-words");
    expect(region).toHaveTextContent(
      "Shared company projects, files, invoices, work orders and assets are hidden until it is reactivated. Items you own stay visible.",
    );
  });

  it("lists every suspended company when there are several", () => {
    render(
      <CompanySuspendedBanner
        companies={[
          { id: "c1", name: "Acme" },
          { id: "c2", name: "Globex" },
        ]}
      />,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("These companies are suspended. Contact Dobeu to reactivate them.");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Acme", "Globex"]);
    expect(region).toHaveTextContent("hidden until they are reactivated");
  });

  it("links to the Dobeu contact email as the remedy", () => {
    render(<CompanySuspendedBanner companies={[{ id: "c1", name: "Acme" }]} />);
    const link = screen.getByRole("link", { name: `Email ${NAP.email}` });
    expect(link).toHaveAttribute("href", `mailto:${NAP.email}`);
  });

  it("renders company names as text, not markup", () => {
    render(<CompanySuspendedBanner companies={[{ id: "c1", name: "<b>x</b>" }]} />);
    expect(screen.getByRole("status").querySelector("b")).toBeNull();
  });
});
