import { describe, expect, it } from "vitest";
import { routeTransitionHref } from "@/lib/route-light";

const base = {
  href: "/pricing",
  currentHref: "https://dobeu.net/",
  target: null,
  download: false,
  modified: false,
  defaultPrevented: false,
  reducedMotion: false,
  viewTransitions: true,
} as const;

describe("routeTransitionHref", () => {
  it("returns the same-origin path for an internal page change", () => {
    expect(routeTransitionHref(base)).toBe("/pricing");
  });

  it("keeps search and hash on the destination", () => {
    expect(
      routeTransitionHref({
        ...base,
        href: "/services?from=nav#work",
      }),
    ).toBe("/services?from=nav#work");
  });

  it("skips same-page hash jumps so in-page anchors stay instant", () => {
    expect(
      routeTransitionHref({
        ...base,
        href: "/#faq",
        currentHref: "https://dobeu.net/",
      }),
    ).toBeNull();
  });

  it("skips external, protocol, new-tab, and modified clicks", () => {
    expect(
      routeTransitionHref({ ...base, href: "https://github.com/Dobeu-tech-eco" }),
    ).toBeNull();
    expect(routeTransitionHref({ ...base, href: "mailto:jeremyw@dobeu.net" })).toBeNull();
    expect(routeTransitionHref({ ...base, href: "tel:+18483187664" })).toBeNull();
    expect(routeTransitionHref({ ...base, target: "_blank" })).toBeNull();
    expect(routeTransitionHref({ ...base, modified: true })).toBeNull();
    expect(routeTransitionHref({ ...base, download: true })).toBeNull();
    expect(routeTransitionHref({ ...base, defaultPrevented: true })).toBeNull();
  });

  it("skips when reduced motion is on or the API is missing", () => {
    expect(routeTransitionHref({ ...base, reducedMotion: true })).toBeNull();
    expect(routeTransitionHref({ ...base, viewTransitions: false })).toBeNull();
  });
});
