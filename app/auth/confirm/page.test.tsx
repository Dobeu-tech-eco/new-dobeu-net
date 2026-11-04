import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "sb-otp-pending" && jar.value ? { value: jar.value } : undefined),
  }),
}));

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: auth.getUser } }),
}));

import ConfirmPage, { metadata } from "@/app/auth/confirm/page";

beforeEach(() => {
  auth.getUser.mockReset();
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
});

afterEach(() => {
  cleanup();
  jar.value = undefined;
});

async function renderPage(next = "/portal") {
  render(await ConfirmPage({ searchParams: Promise.resolve({ next, token_hash: "leak", type: "invite" }) }));
}

describe("ConfirmPage", () => {
  it("does not override the referrer policy (no-referrer would make the POST send Origin: null)", () => {
    expect(metadata.referrer).toBeUndefined();
  });

  it("accepts an already-decoded cookie value", async () => {
    jar.value = JSON.stringify({ token_hash: "abc", type: "invite" });
    await renderPage();
    expect(screen.getByRole("button", { name: "Continue signing in" })).toBeTruthy();
  });

  it("shows the form when the pending cookie is valid and ignores query tokens", async () => {
    jar.value = encodeURIComponent(JSON.stringify({ token_hash: "abc", type: "invite" }));
    await renderPage();
    expect(screen.getByRole("button", { name: "Continue signing in" })).toBeTruthy();
    expect(document.querySelector("form")?.getAttribute("method")).toBe("post");
    expect(document.querySelector("form")?.getAttribute("action")).toBe("/auth/confirm/submit");
    expect(document.querySelector('input[name="token_hash"]')).toBeNull();
  });

  it("shows expired copy when the cookie is missing", async () => {
    await renderPage();
    expect(screen.getByText(/expired or was already used/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /login/i }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows expired copy when the cookie is malformed", async () => {
    jar.value = "garbage";
    await renderPage();
    expect(screen.getByText(/expired or was already used/)).toBeTruthy();
  });

  describe("when the visitor already has a session", () => {
    const validCookie = () => JSON.stringify({ token_hash: "abc", type: "invite" });

    it("shows a sign-out notice instead of the form", async () => {
      jar.value = validCookie();
      auth.getUser.mockResolvedValue({
        data: { user: { id: "u1", email: "me@example.com" } },
        error: null,
      });
      await renderPage();
      expect(screen.getByText(/already signed in as me@example\.com/)).toBeTruthy();
      expect(screen.getByText(/Sign out, then open the sign-in link from your email again/)).toBeTruthy();
      expect(document.querySelector("form")).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByRole("link", { name: /portal/i }).getAttribute("href")).toBe("/portal");
    });

    it("still shows the form for a signed-out visitor", async () => {
      jar.value = validCookie();
      await renderPage();
      expect(screen.getByRole("button", { name: "Continue signing in" })).toBeTruthy();
    });

    it("falls back to the form when getUser throws", async () => {
      jar.value = validCookie();
      auth.getUser.mockRejectedValue(new Error("boom"));
      await renderPage();
      expect(screen.getByRole("button", { name: "Continue signing in" })).toBeTruthy();
    });
  });
});
