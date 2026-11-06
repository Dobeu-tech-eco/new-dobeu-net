import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

type Result = { data?: unknown; error?: { message: string } | null; count?: number | null };
const db = vi.hoisted(() => ({
  results: {} as Record<string, Result>,
  calls: [] as { table: string; opts: unknown }[],
}));

function chain(key: string): Record<string, unknown> {
  const b: Record<string, unknown> = {
    select: (_c: string, opts?: unknown) => {
      db.calls.push({ table: key, opts });
      const countKey = opts ? `${key}:count` : key;
      return makeThenable(countKey);
    },
  };
  return b;
}
function makeThenable(key: string) {
  const t: Record<string, unknown> = {};
  const self = () => t;
  t.limit = self;
  t.eq = self;
  t.in = self;
  t.then = (res: (v: Result) => unknown) => res(db.results[key] ?? { data: [], error: null, count: 0 });
  return t;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1", user_metadata: {} } } }) },
    from: (table: string) => chain(table),
  }),
}));

vi.mock("@/components/portal/PendingInvites", () => ({
  PendingInvites: ({ userId }: { userId: string }) => <div data-testid="pending-invites">{userId}</div>,
}));

import PortalDashboard from "@/app/portal/page";

afterEach(() => {
  cleanup();
  db.results = {};
  db.calls = [];
});

describe("PortalDashboard", () => {
  it("uses exact counts, not the 5-row list, for tiles", async () => {
    db.results = {
      projects: {
        data: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, title: `P${i}`, status: "active" })),
        error: null,
      },
      "projects:count": { count: 8, error: null },
      "invoices:count": { count: 7, error: null },
    };
    render(await PortalDashboard());
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(db.calls.filter((c) => c.opts).length).toBe(2);
  });

  it("shows an alert instead of the empty state when the projects query fails", async () => {
    db.results = { projects: { data: null, error: { message: "boom" } } };
    render(await PortalDashboard());
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("No projects yet")).toBeNull();
  });

  it("renders the fixed notice for a known code and passes the session user id to PendingInvites", async () => {
    render(await PortalDashboard({ searchParams: Promise.resolve({ notice: "invite_accepted" }) }));
    expect(screen.getByRole("status").textContent).toBe("You've joined the company.");
    expect(screen.getByTestId("pending-invites").textContent).toBe("user-1");
  });

  it("renders an alert notice for failure codes and ignores unknown codes", async () => {
    render(await PortalDashboard({ searchParams: Promise.resolve({ notice: "invite_response_failed" }) }));
    expect(screen.getByRole("alert").textContent).toBe("Couldn't save your answer. Try again.");
    cleanup();
    render(await PortalDashboard({ searchParams: Promise.resolve({ notice: "<b>x</b>" }) }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
