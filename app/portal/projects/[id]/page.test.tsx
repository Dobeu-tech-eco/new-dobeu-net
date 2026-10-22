import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

type Result = { data?: unknown; error?: { message: string } | null };
const db = vi.hoisted(() => ({ results: {} as Record<string, Result> }));

function builder(table: string) {
  const t: Record<string, unknown> = {};
  const self = () => t;
  t.select = self;
  t.eq = self;
  t.order = self;
  t.single = () => Promise.resolve(db.results[table]);
  t.then = (res: (v: Result) => unknown) => res(db.results[table] ?? { data: [], error: null });
  return t;
}

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => builder(table) }),
}));

import ProjectDetailPage from "@/app/portal/projects/[id]/page";

const url = "https://invoice.stripe.com/i/x";
function inv(id: string, status: string, hosted_invoice_url: string | null) {
  return { id, status, hosted_invoice_url, amount_cents: 1000, currency: "USD", due_date: "2026-12-01" };
}

afterEach(() => {
  cleanup();
  db.results = {};
});

async function renderPage() {
  render(await ProjectDetailPage({ params: Promise.resolve({ id: "p1" }) }));
}

describe("project detail invoices", () => {
  it("shows Pay only for open/overdue invoices with a URL", async () => {
    db.results = {
      projects: { data: { id: "p1", title: "T", status: "active", description: null }, error: null },
      invoices: {
        data: [
          inv("a", "open", url),
          inv("b", "overdue", url),
          inv("c", "paid", url),
          inv("d", "open", null),
        ],
        error: null,
      },
    };
    await renderPage();
    const links = screen.getAllByRole("link", { name: "Pay" });
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe(url);
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toBe("noreferrer");
    expect(screen.getAllByText(/Due /).length).toBe(4);
  });

  it("shows an alert when the invoices query errors", async () => {
    db.results = {
      projects: { data: { id: "p1", title: "T", status: "active", description: null }, error: null },
      invoices: { data: null, error: { message: "x" } },
    };
    await renderPage();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("No invoices for this project yet.")).toBeNull();
  });
});
