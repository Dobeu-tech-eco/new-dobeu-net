import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { listAllUsers, USERS_PER_PAGE, USERS_MAX_PAGES } from "./admin-user-list";

const rows = (n: number, prefix = "u") =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    email: `${prefix}${i}@example.com`,
  }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = (listUsers: unknown) => ({ auth: { admin: { listUsers } } }) as any;

afterEach(() => vi.restoreAllMocks());

describe("listAllUsers", () => {
  it("fetches and concatenates a second page", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: rows(USERS_PER_PAGE, "a") }, error: null })
      .mockResolvedValueOnce({ data: { users: rows(3, "b") }, error: null });
    const r = await listAllUsers(admin(listUsers));
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 200 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 });
    expect(r.users).toHaveLength(USERS_PER_PAGE + 3);
    expect(r).toMatchObject({ failed: false, truncated: false });
  });

  it("stops at a short first page", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValue({ data: { users: rows(5) }, error: null });
    const r = await listAllUsers(admin(listUsers));
    expect(listUsers).toHaveBeenCalledTimes(1);
    expect(r.users).toHaveLength(5);
    expect(r.truncated).toBe(false);
  });

  it("fails with no users when a later page errors", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: rows(USERS_PER_PAGE) }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const r = await listAllUsers(admin(listUsers));
    expect(r).toEqual({ users: [], failed: true, truncated: false });
  });

  it("fails when listUsers throws, without logging the error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const listUsers = vi.fn().mockRejectedValue(new Error("private text"));
    const r = await listAllUsers(admin(listUsers));
    expect(r).toEqual({ users: [], failed: true, truncated: false });
    expect(warn).toHaveBeenCalledWith(
      "[admin-user-list] auth.admin.listUsers failed",
    );
  });

  it("reports truncated after 50 full pages", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValue({ data: { users: rows(USERS_PER_PAGE) }, error: null });
    const r = await listAllUsers(admin(listUsers));
    expect(listUsers).toHaveBeenCalledTimes(USERS_MAX_PAGES);
    expect(r.truncated).toBe(true);
    expect(r.failed).toBe(false);
    expect(r.users).toHaveLength(USERS_PER_PAGE * USERS_MAX_PAGES);
  });
});
