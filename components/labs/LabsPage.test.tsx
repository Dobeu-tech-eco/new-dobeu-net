import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAB_DEMOS, resolveLabSatelliteLinks } from "@/lib/labs-data";
import { LabsPage } from "./LabsPage";

vi.mock("@/components/labs/DemoCard", () => ({
  DemoCard: ({ demo }: { demo: { title: string } }) => <h2>{demo.title}</h2>,
}));
vi.mock("@/components/labs/ExperimentSlot", () => ({
  ExperimentSlot: () => null,
}));

const TUTOR = "NEXT_PUBLIC_SATELLITE_TUTOR_URL";
const STAFFING = "NEXT_PUBLIC_SATELLITE_STAFFING_URL";

beforeEach(() => {
  vi.stubEnv(TUTOR, "");
  vi.stubEnv(STAFFING, "");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("resolveLabSatelliteLinks", () => {
  it("returns nothing when no satellite is configured", () => {
    expect(resolveLabSatelliteLinks({})).toEqual([]);
  });

  it("returns only Tutor, with the validated origin", () => {
    expect(
      resolveLabSatelliteLinks({
        NEXT_PUBLIC_SATELLITE_TUTOR_URL: "https://tutor.dobeu.net/",
        NEXT_PUBLIC_SATELLITE_STAFFING_URL: "https://staffing.dobeu.net",
      }),
    ).toEqual([{ id: "tutor", label: "Tutor", href: "https://tutor.dobeu.net" }]);
  });

  it("leaves the demo list unchanged", () => {
    expect(LAB_DEMOS.map((demo) => demo.id)).toEqual([
      "work-order",
      "shader",
      "lead-pipeline",
    ]);
  });
});

describe("Labs satellite discovery links", () => {
  it("renders no satellite list when the env var is unset", () => {
    vi.stubEnv(TUTOR, undefined);
    vi.stubEnv(STAFFING, undefined);
    render(<LabsPage />);
    expect(screen.queryByRole("link", { name: "Tutor" })).toBeNull();
    expect(screen.queryByTestId("lab-satellite-links")).toBeNull();
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
    render(<LabsPage />);
    expect(screen.queryByRole("link", { name: "Tutor" })).toBeNull();
    expect(screen.queryByTestId("lab-satellite-links")).toBeNull();
  });

  it("links Tutor to the exact validated origin", () => {
    vi.stubEnv(TUTOR, "https://tutor.dobeu.net");
    render(<LabsPage />);
    const link = screen.getByRole("link", { name: "Tutor" });
    expect(link).toHaveAttribute("href", "https://tutor.dobeu.net");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("never renders a staffing link", () => {
    vi.stubEnv(TUTOR, "https://tutor.dobeu.net");
    vi.stubEnv(STAFFING, "https://staffing.dobeu.net");
    render(<LabsPage />);
    expect(screen.queryByRole("link", { name: /staffing/i })).toBeNull();
    expect(screen.getByTestId("lab-satellite-links").querySelectorAll("a")).toHaveLength(1);
  });
});
