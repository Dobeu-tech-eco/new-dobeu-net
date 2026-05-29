import { describe, it, expect, beforeEach } from "vitest";
import {
  cn,
  isAdminEmail,
  formatCurrency,
  captureAcquisition,
} from "@/lib/utils";

describe("cn", () => {
  it("merges conditional classes and drops falsy values", () => {
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe(
      "text-sm font-bold",
    );
  });
  it("dedupes conflicting tailwind utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("isAdminEmail", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "jeremyw@dobeu.net, admin@dobeu.net";
  });

  it("returns false for null, undefined, or empty input", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("matches case-insensitively against the env allowlist", () => {
    expect(isAdminEmail("JeremyW@Dobeu.net")).toBe(true);
    expect(isAdminEmail("admin@dobeu.net")).toBe(true);
  });

  it("rejects addresses not in the allowlist", () => {
    expect(isAdminEmail("stranger@example.com")).toBe(false);
  });
});

describe("formatCurrency", () => {
  it("formats whole-dollar cents without decimals", () => {
    expect(formatCurrency(150000)).toBe("$1,500");
  });
  it("keeps cents when present", () => {
    expect(formatCurrency(2599)).toBe("$25.99");
  });
});

describe("captureAcquisition", () => {
  it("extracts known utm/click params and referrer, ignoring others", () => {
    const sp = new URLSearchParams("utm_source=google&utm_medium=cpc&foo=bar");
    expect(captureAcquisition(sp, "https://ref.example")).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      referrer: "https://ref.example",
    });
  });

  it("omits referrer when not provided", () => {
    const sp = new URLSearchParams("gclid=123");
    expect(captureAcquisition(sp)).toEqual({ gclid: "123" });
  });
});
