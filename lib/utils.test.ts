import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cn,
  isAdminEmail,
  parseAdminEmails,
  formatCurrency,
  captureAcquisition,
  getSiteUrl,
  getPosthogHost,
  buildAuthCallbackUrl,
  resolveAuthOrigin,
  requiresAal2Stepup,
  requiresMfaEnrollment
} from "@/lib/utils";

describe("cn", () => {
  it("merges conditional classes and drops falsy values", () => {
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
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

describe("parseAdminEmails", () => {
  it("trims, lowercases, and drops empties", () => {
    process.env.ADMIN_EMAILS = "  JeremyW@Dobeu.net , admin@dobeu.net ,, ";
    expect(parseAdminEmails()).toEqual(["jeremyw@dobeu.net", "admin@dobeu.net"]);
  });

  it("returns [] when env var is missing or empty", () => {
    delete process.env.ADMIN_EMAILS;
    expect(parseAdminEmails()).toEqual([]);
    process.env.ADMIN_EMAILS = "";
    expect(parseAdminEmails()).toEqual([]);
  });
});

describe("getSiteUrl", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it("falls back to https://dobeu.net when env var is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl()).toBe("https://dobeu.net");
  });

  it("falls back to https://dobeu.net when env var is the empty string (Vercel sensitive-env injection)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "";
    expect(getSiteUrl()).toBe("https://dobeu.net");
  });

  it("falls back when env var is whitespace-only", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "   ";
    expect(getSiteUrl()).toBe("https://dobeu.net");
  });

  it("returns the configured site url when present", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.dobeu.net";
    expect(getSiteUrl()).toBe("https://staging.dobeu.net");
  });
});

describe("buildAuthCallbackUrl", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    if (originalWindow === undefined) {
      // @ts-expect-error vitest may delete window in node
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    vi.unstubAllGlobals();
  });

  it("uses canonical site url when window is unavailable (SSR / tests)", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    // @ts-expect-error simulate node
    delete globalThis.window;
    expect(buildAuthCallbackUrl("/portal")).toBe(
      "https://dobeu.net/auth/callback?next=%2Fportal",
    );
  });

  it("uses browser origin on localhost", () => {
    vi.stubGlobal("window", {
      location: { hostname: "localhost", origin: "http://localhost:3000" },
    });
    expect(buildAuthCallbackUrl("/portal/tickets")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fportal%2Ftickets",
    );
  });

  it("uses browser origin on vercel preview", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "dobeu-net-git-main-dobeu.vercel.app",
        origin: "https://dobeu-net-git-main-dobeu.vercel.app",
      },
    });
    expect(resolveAuthOrigin()).toBe("https://dobeu-net-git-main-dobeu.vercel.app");
  });

  it("uses canonical site url on production custom domain", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.stubGlobal("window", {
      location: { hostname: "dobeu.net", origin: "https://dobeu.net" },
    });
    expect(buildAuthCallbackUrl("/admin")).toBe(
      "https://dobeu.net/auth/callback?next=%2Fadmin",
    );
  });

  it("sanitizes open-redirect next paths", () => {
    // @ts-expect-error simulate node
    delete globalThis.window;
    expect(buildAuthCallbackUrl("https://evil.example")).toBe(
      "https://dobeu.net/auth/callback?next=%2Fportal",
    );
    expect(buildAuthCallbackUrl("/\\evil.example")).toBe(
      "https://dobeu.net/auth/callback?next=%2Fportal",
    );
  });
});

describe("getPosthogHost", () => {
  const original = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    else process.env.NEXT_PUBLIC_POSTHOG_HOST = original;
  });

  it("falls back when env var is unset, empty, or whitespace", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    expect(getPosthogHost()).toBe("https://us.i.posthog.com");
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "";
    expect(getPosthogHost()).toBe("https://us.i.posthog.com");
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "  ";
    expect(getPosthogHost()).toBe("https://us.i.posthog.com");
  });

  it("returns the configured host when present", () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
    expect(getPosthogHost()).toBe("https://eu.i.posthog.com");
  });
});

describe("captureAcquisition", () => {
  it("extracts known utm/click params and referrer, ignoring others", () => {
    const sp = new URLSearchParams("utm_source=google&utm_medium=cpc&foo=bar");
    expect(captureAcquisition(sp, "https://ref.example")).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      referrer: "https://ref.example"
    });
  });

  it("omits referrer when not provided", () => {
    const sp = new URLSearchParams("gclid=123");
    expect(captureAcquisition(sp)).toEqual({ gclid: "123" });
  });
});

describe("requiresAal2Stepup", () => {
  it("returns false when no factor is enrolled (bootstrap: aal1/aal1)", () => {
    expect(requiresAal2Stepup({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });
  it("returns true when a factor exists but session is still aal1", () => {
    expect(requiresAal2Stepup({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
  });
  it("returns false when the session already satisfied aal2", () => {
    expect(requiresAal2Stepup({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
  });
  it("returns false when assurance info is null (fail-open for shape, gate handles network errors separately)", () => {
    expect(requiresAal2Stepup(null)).toBe(false);
  });
});

describe("requiresMfaEnrollment", () => {
  it("never forces enrollment for non-admins (keeps /portal reachable, no loop)", () => {
    expect(requiresMfaEnrollment({ currentLevel: "aal1", nextLevel: "aal1" }, false)).toBe(false);
    expect(requiresMfaEnrollment(null, false)).toBe(false);
  });
  it("forces an unenrolled admin (aal1/aal1) to enroll", () => {
    expect(requiresMfaEnrollment({ currentLevel: "aal1", nextLevel: "aal1" }, true)).toBe(true);
  });
  it("forces an admin with a factor but only an aal1 session (not yet stepped up)", () => {
    expect(requiresMfaEnrollment({ currentLevel: "aal1", nextLevel: "aal2" }, true)).toBe(true);
  });
  it("allows an admin whose session already satisfied aal2", () => {
    expect(requiresMfaEnrollment({ currentLevel: "aal2", nextLevel: "aal2" }, true)).toBe(false);
  });
  it("fails CLOSED for an admin with indeterminate assurance (null)", () => {
    expect(requiresMfaEnrollment(null, true)).toBe(true);
  });
});
