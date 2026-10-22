import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "sb-otp-pending" && jar.value ? { value: jar.value } : undefined),
  }),
}));

import ConfirmPage, { metadata } from "@/app/auth/confirm/page";

afterEach(() => {
  cleanup();
  jar.value = undefined;
});

async function renderPage(next = "/portal") {
  render(await ConfirmPage({ searchParams: Promise.resolve({ next, token_hash: "leak", type: "invite" }) }));
}

describe("ConfirmPage", () => {
  it("sets no-referrer", () => {
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("shows the form when the pending cookie is valid and ignores query tokens", async () => {
    jar.value = encodeURIComponent(JSON.stringify({ token_hash: "abc", type: "invite" }));
    await renderPage();
    expect(screen.getByRole("button", { name: "Continue signing in" })).toBeTruthy();
    expect(document.querySelector("form")?.getAttribute("method")).toBe("post");
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
});
