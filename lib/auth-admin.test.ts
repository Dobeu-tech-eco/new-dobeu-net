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
  const adminWith = (result: unknown) => {
    const rpc = vi.fn(async () => result);
    return { rpc, admin: { rpc } as never };
  };

  it("calls the lookup rpc with the lowercased, trimmed email", async () => {
    const { admin, rpc } = adminWith({ data: "u1", error: null });
    expect(await findUserIdByEmail(admin, " A@B.com ")).toBe("u1");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("find_auth_user_id_by_email", {
      p_email: "a@b.com",
    });
  });

  it("returns null when no user matches", async () => {
    const { admin } = adminWith({ data: null, error: null });
    expect(await findUserIdByEmail(admin, "a@b.com")).toBeNull();
  });

  it("fails closed on an rpc error (including a missing function)", async () => {
    const { admin } = adminWith({
      data: null,
      error: { code: "PGRST202", message: "not found" },
    });
    expect(await findUserIdByEmail(admin, "a@b.com")).toBeNull();
  });

  it("fails closed when the rpc throws", async () => {
    const admin = {
      rpc: vi.fn(async () => {
        throw new Error("boom");
      }),
    } as never;
    expect(await findUserIdByEmail(admin, "a@b.com")).toBeNull();
  });
});
