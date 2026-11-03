import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("@/components/admin/InviteUserForm", () => ({
  InviteUserForm: () => null,
}));
import AdminUsersPage from "./page";

const profiles = [
  {
    id: "u1",
    full_name: "Ada Lovelace",
    company: "Analytical",
    created_at: "x",
  },
];

function client(
  res: { data: unknown; error: { message: string } | null },
  listUsers: () => Promise<unknown>,
) {
  const b: Record<string, unknown> = {
    select: () => b,
    order: () => b,
    limit: () => b,
    then: (resolve: (v: unknown) => void) => resolve(res),
  };
  return { from: () => b, auth: { admin: { listUsers } } };
}
const params = { searchParams: Promise.resolve({}) };

beforeEach(() => h.createAdminClient.mockReset());
afterEach(cleanup);

describe("admin users page degradation", () => {
  it.each([
    [
      "listUsers throws",
      async () => {
        throw new Error("private provider text");
      },
    ],
    [
      "listUsers returns an error",
      async () => ({ data: null, error: { message: "private provider text" } }),
    ],
  ])("still lists users when %s", async (_n, listUsers) => {
    h.createAdminClient.mockReturnValue(
      client({ data: profiles, error: null }, listUsers),
    );
    const { container } = render(await AdminUsersPage(params));
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(
      screen.getByText(/Admin badges could not be loaded/),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain("private provider");
  });

  it("hides the list when the profiles read fails", async () => {
    h.createAdminClient.mockReturnValue(
      client(
        { data: null, error: { message: "private provider text" } },
        async () => ({ data: { users: [] }, error: null }),
      ),
    );
    const { container } = render(await AdminUsersPage(params));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load users. Try again.",
    );
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("private provider");
  });
});
