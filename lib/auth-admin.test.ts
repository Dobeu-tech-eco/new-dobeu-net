import { describe, it, expect, vi } from "vitest";
import { findUserIdByEmail, isAlreadyRegistered } from "@/lib/auth-admin";

describe("isAlreadyRegistered", () => {
  it.each([
    [{ message: "User already registered" }],
    [{ message: "A user has already been registered" }],
    [{ code: "email_exists" }],
  ])("detects %j", (e) => expect(isAlreadyRegistered(e)).toBe(true));

  it("does not treat a bare 422 as already registered", () => {
    expect(isAlreadyRegistered({ status: 422 })).toBe(false);
    expect(
      isAlreadyRegistered({ status: 422, code: "weak_password", message: "Password too short" }),
    ).toBe(false);
  });

  it("ignores other errors", () => {
    expect(isAlreadyRegistered({ message: "smtp down", status: 500 })).toBe(false);
  });
});

describe("findUserIdByEmail", () => {
  const adminWith = (pages: { id: string; email: string }[][], error = false) => {
    const listUsers = vi.fn(async ({ page }: { page: number }) =>
      error
        ? { data: null, error: { message: "x" } }
        : { data: { users: pages[page - 1] ?? [] }, error: null },
    );
    return {
      listUsers,
      admin: { auth: { admin: { listUsers } } } as never,
    };
  };

  it("matches case-insensitively", async () => {
    const { admin } = adminWith([[{ id: "u1", email: "A@B.com" }]]);
    expect(await findUserIdByEmail(admin, "a@b.com")).toBe("u1");
  });

  it("returns null on a list error", async () => {
    const { admin } = adminWith([], true);
    expect(await findUserIdByEmail(admin, "a@b.com")).toBeNull();
  });

  it("scans up to 20 full pages then stops", async () => {
    const full = Array.from({ length: 200 }, (_, i) => ({
      id: `u${i}`,
      email: `u${i}@x.com`,
    }));
    const { admin, listUsers } = adminWith(Array.from({ length: 30 }, () => full));
    expect(await findUserIdByEmail(admin, "nobody@x.com")).toBeNull();
    expect(listUsers).toHaveBeenCalledTimes(20);
  });
});
