import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: h.createAdminClient,
}));

import AdminOverview from "./page";

type Result = { data?: unknown; count?: number | null; error: unknown };

const tileValue = (label: string) =>
  screen.getAllByText(label).find((n) => n.tagName === "P")
    ?.previousElementSibling;

function stub(opts: {
  list: Result;
  count: Result;
  gte?: (...args: unknown[]) => void;
}) {
  const ok: Result = { data: [], count: 0, error: null };
  h.createAdminClient.mockReturnValue({
    from: (table: string) => ({
      select: (_cols: string, o?: { head?: boolean }) => {
        const result =
          table === "leads" ? (o?.head ? opts.count : opts.list) : ok;
        const chain: Record<string, unknown> = {
          then: (resolve: (v: Result) => void) => resolve(result),
        };
        for (const m of ["order", "limit", "in"]) chain[m] = () => chain;
        chain.gte = (...args: unknown[]) => {
          if (table === "leads" && o?.head) opts.gte?.(...args);
          return chain;
        };
        return chain;
      },
    }),
  });
}

const tenLeads = Array.from({ length: 10 }, (_, i) => ({
  id: `l${i}`,
  email: `l${i}@example.com`,
  name: `Lead ${i}`,
  source: "form",
  first_seen: "2026-10-01T00:00:00Z",
  utm_source: null,
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("admin overview leads tile", () => {
  it("shows the exact 30d count, not the list length", async () => {
    const gte = vi.fn();
    stub({
      list: { data: tenLeads, error: null },
      count: { count: 42, error: null },
      gte,
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("New leads (30d)")).toHaveTextContent("42");
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(gte).toHaveBeenCalledTimes(1);
    const [col, iso] = gte.mock.calls[0];
    expect(col).toBe("first_seen");
    const ageMs = Date.now() - new Date(iso as string).getTime();
    expect(Math.abs(ageMs - 30 * 24 * 60 * 60 * 1000)).toBeLessThan(2 * 60 * 60 * 1000);
  });

  it("shows an em dash when the count query errors", async () => {
    stub({
      list: { data: tenLeads, error: null },
      count: { count: null, error: { message: "private" } },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("New leads (30d)")).toHaveTextContent("—");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("keeps the exact count but hides the list when only the list errors", async () => {
    stub({
      list: { data: null, error: { message: "private" } },
      count: { count: 42, error: null },
    });
    render(await AdminOverview({ searchParams: Promise.resolve({}) }));
    expect(tileValue("New leads (30d)")).toHaveTextContent("42");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/No leads yet/)).not.toBeInTheDocument();
  });
});
