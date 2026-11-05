import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  dialog: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("@/components/admin/NewWorkOrderForClientDialog", () => ({
  NewWorkOrderForClientDialog: (props: {
    clients: { id: string; label: string }[];
    disabled?: boolean;
  }) => {
    h.dialog(props);
    return null;
  },
}));

import AdminTicketsPage from "./page";

const user = (i: number) => ({ id: `u${i}`, email: `u${i}@example.com` });
const users = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => user(from + i));

function stub(listUsers: ReturnType<typeof vi.fn>) {
  const rows = (data: unknown) => {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => void) =>
        resolve({ data, error: null }),
    };
    for (const m of ["order", "limit", "eq", "select"]) chain[m] = () => chain;
    return chain;
  };
  h.createAdminClient.mockReturnValue({
    from: (table: string) => ({
      select: () =>
        rows(
          table === "work_orders"
            ? [
                {
                  id: "w1",
                  title: "Fix the logo",
                  service_type: "logo",
                  status: "open",
                  created_at: "2026-10-01T00:00:00Z",
                  quoted_amount_cents: null,
                  created_by: "abcdefgh1234",
                },
              ]
            : [],
        ),
    }),
    auth: { admin: { listUsers } },
  });
}

const renderPage = async () =>
  render(await AdminTicketsPage({ searchParams: Promise.resolve({}) }));
const lastDialog = () => h.dialog.mock.calls.at(-1)![0];

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("admin tickets client picker paging", () => {
  it("fetches a second page and includes its users", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: users(0, 200) }, error: null })
      .mockResolvedValueOnce({ data: { users: users(200, 5) }, error: null });
    stub(listUsers);
    await renderPage();
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 200 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 });
    expect(lastDialog().clients).toHaveLength(205);
    expect(lastDialog().clients.at(-1).label).toBe("u204@example.com");
    expect(lastDialog().disabled).toBe(false);
    expect(screen.queryByText(/truncated/)).not.toBeInTheDocument();
  });

  it("stops at a short page", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValue({ data: { users: users(0, 3) }, error: null });
    stub(listUsers);
    await renderPage();
    expect(listUsers).toHaveBeenCalledTimes(1);
    expect(lastDialog().clients).toHaveLength(3);
  });

  it("keeps the table and disables the picker when a later page errors", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: users(0, 200) }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "private" } });
    stub(listUsers);
    await renderPage();
    expect(lastDialog().disabled).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent(
      /Post work is unavailable/,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Fix the logo")).toBeInTheDocument();
  });

  it("caps at 50 pages and shows a non-blocking truncation notice", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValue({ data: { users: users(0, 200) }, error: null });
    stub(listUsers);
    await renderPage();
    expect(listUsers).toHaveBeenCalledTimes(50);
    expect(lastDialog().disabled).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent(/truncated/);
    expect(screen.getByText("Fix the logo")).toBeInTheDocument();
  });
});
