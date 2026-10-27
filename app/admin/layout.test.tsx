import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  getAal: vi.fn(),
}));

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: h.getUser,
      mfa: { getAuthenticatorAssuranceLevel: h.getAal },
    },
  })),
}));

vi.mock("@/components/brand/DobeuMark", () => ({ DobeuMark: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/portal/LogoutButton", () => ({
  LogoutButton: () => null,
}));
vi.mock("@/components/portal/AnalyticsIdentify", () => ({
  AnalyticsIdentify: () => null,
}));

import AdminLayout from "./layout";

const ORIGINAL_ADMINS = process.env.ADMIN_EMAILS;

beforeEach(() => {
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
  h.getUser.mockReset();
  h.getAal.mockReset();
});

afterEach(() => {
  cleanup();
  if (ORIGINAL_ADMINS === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL_ADMINS;
});

const signIn = (email: string | null) =>
  h.getUser.mockResolvedValue({
    data: { user: email ? { id: "u1", email } : null },
  });

async function redirectTarget(): Promise<string> {
  try {
    await AdminLayout({ children: <p>secret</p> });
  } catch (err) {
    if (err instanceof RedirectError) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

describe("AdminLayout guards", () => {
  it("redirects an unauthenticated visitor to /portal?error=not_authorized", async () => {
    signIn(null);
    expect(await redirectTarget()).toBe("/portal?error=not_authorized");
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("redirects a non-admin user to /portal?error=not_authorized", async () => {
    signIn("client@example.com");
    expect(await redirectTarget()).toBe("/portal?error=not_authorized");
    expect(h.getAal).not.toHaveBeenCalled();
  });

  it("redirects an admin with no MFA factor to enrolment", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
    });
    expect(await redirectTarget()).toBe("/portal/settings/mfa?next=/admin");
  });

  it("redirects an AAL1 admin with a verified factor to step-up", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
    });
    expect(await redirectTarget()).toBe("/portal/settings/mfa?next=/admin");
  });

  it("fails closed when assurance data is missing", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockResolvedValue({ data: null });
    expect(await redirectTarget()).toBe("/portal/settings/mfa?next=/admin");
  });

  it("fails closed (rejects, renders nothing) when the assurance lookup throws", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockRejectedValue(new Error("boom"));
    await expect(AdminLayout({ children: <p>secret</p> })).rejects.toThrow(
      "boom",
    );
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("renders children for an AAL2 admin", async () => {
    signIn("admin@dobeu.net");
    h.getAal.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
    });
    render(await AdminLayout({ children: <p>secret</p> }));
    expect(screen.getByText("secret")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Admin" })).toBeTruthy();
  });
});
