import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const notFound = vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
  const requireAdminAal2 = vi.fn();
  return { notFound, requireAdminAal2 };
});

vi.mock("next/navigation", () => ({ notFound: h.notFound }));
vi.mock("@/lib/actions/auth", () => ({
  requireAdminAal2: h.requireAdminAal2,
}));

import AdminIntakeDetailPage from "./page";

describe("AdminIntakeDetailPage", () => {
  it("returns not found for a malformed ID before auth or database access", async () => {
    await expect(
      AdminIntakeDetailPage({
        params: Promise.resolve({ id: "not-a-uuid" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(h.notFound).toHaveBeenCalledOnce();
    expect(h.requireAdminAal2).not.toHaveBeenCalled();
  });
});
