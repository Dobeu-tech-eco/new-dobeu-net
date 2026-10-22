import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";
import type { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/resend";
import { logToDatadog } from "@/lib/datadog-server";
import { invoiceAgingToAdmin } from "@/lib/resend-templates";
import { runInvoiceAging } from "./invoice-aging";

vi.mock("@/lib/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/datadog-server", () => ({ logToDatadog: vi.fn() }));

const NOW = new Date("2026-10-22T13:00:00.000Z");
type Invoice = { id: string; due_date: string | null; status: string };
const invoice = (days: number, status = "open"): Invoice => ({
  id: `invoice-${days}-${status}`,
  due_date: new Date(NOW.getTime() - days * 86_400_000)
    .toISOString()
    .slice(0, 10),
  status,
});

function stubInvoices(rows: Invoice[] = [], queryError = false) {
  const stub = buildStubClient({});
  const originalFrom = stub.supabase.from.getMockImplementation()!;
  const ranges = vi.fn();
  const lt = vi.fn();
  stub.supabase.from.mockImplementation((table: string) => {
    const result = originalFrom(table);
    const select = result.select.getMockImplementation()!;
    result.select.mockImplementation((...args: unknown[]) => {
      const chain = select(...args);
      chain.lt = lt.mockReturnValue(chain);
      chain.range = ranges.mockImplementation((start: number, end: number) => {
        const statuses = stub.recorded.find((call) => call.method === "in")
          ?.args[1] as string[];
        const cutoff = lt.mock.calls.at(-1)?.[1] as string;
        return Promise.resolve({
          data: queryError
            ? null
            : rows
                .filter(
                  (row) =>
                    statuses.includes(row.status) &&
                    row.due_date &&
                    row.due_date < cutoff,
                )
                .slice(start, end + 1),
          error: queryError ? { message: "database unavailable" } : null,
        });
      });
      return chain;
    });
    return result;
  });
  return {
    ...stub,
    ranges,
    lt,
    client: stub.supabase as unknown as ReturnType<typeof createAdminClient>,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv(
    "ADMIN_EMAILS",
    "first@example.com, SECOND@example.com,first@example.com, ",
  );
  vi.mocked(sendEmail).mockResolvedValue({ ok: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("runInvoiceAging", () => {
  it("sends no email with zero overdue invoices; excludes paid, void, undated and not-yet-due rows", async () => {
    const stub = stubInvoices([
      invoice(0),
      invoice(-1),
      invoice(40, "paid"),
      invoice(40, "void"),
      { id: "no-date", status: "open", due_date: null },
    ]);
    await expect(runInvoiceAging(stub.client, NOW)).resolves.toEqual({
      overdue: 0,
      over7: 0,
      over14: 0,
      over30: 0,
      emailSent: false,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(stub.lt).toHaveBeenCalledWith("due_date", "2026-10-22");
    expect(stub.recorded).toContainEqual({
      table: "invoices",
      method: "in",
      args: ["status", ["open", "overdue"]],
    });
  });

  it("uses strict cumulative >7, >14, >30 boundaries and sends exactly one admin-only email", async () => {
    const stub = stubInvoices(
      [1, 7, 8, 14, 15, 30, 31]
        .map((days) => invoice(days))
        .concat(invoice(45, "overdue")),
    );
    const summary = await runInvoiceAging(stub.client, NOW);
    expect(summary).toEqual({
      overdue: 8,
      over7: 6,
      over14: 4,
      over30: 2,
      emailSent: true,
    });
    expect(sendEmail).toHaveBeenCalledExactlyOnceWith({
      to: ["first@example.com", "second@example.com"],
      ...invoiceAgingToAdmin(summary),
    });
    expect(logToDatadog).toHaveBeenCalledWith(
      "info",
      "Invoice aging completed",
      summary,
    );
    expect(
      stub.recorded.every((call) =>
        ["select", "in", "order"].includes(call.method),
      ),
    ).toBe(true);
  });

  it("paginates beyond the database default row limit", async () => {
    const stub = stubInvoices(
      Array.from({ length: 1001 }, (_, i) => ({
        ...invoice(31),
        id: String(i),
      })),
    );
    const result = await runInvoiceAging(stub.client, NOW);
    expect(result.overdue).toBe(1001);
    expect(stub.ranges.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not send when ADMIN_EMAILS is not configured", async () => {
    vi.stubEnv("ADMIN_EMAILS", undefined);
    const result = await runInvoiceAging(
      stubInvoices([invoice(8)]).client,
      NOW,
    );
    expect(result.emailSent).toBe(false);
    expect(result.overdue).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(logToDatadog).toHaveBeenCalledWith(
      "warn",
      expect.stringContaining("ADMIN_EMAILS"),
    );
  });

  it.each(["result", "throw"])(
    "treats email failure (%s) as non-fatal",
    async (mode) => {
      if (mode === "result")
        vi.mocked(sendEmail).mockResolvedValue({
          ok: false,
          error: "unavailable",
        });
      else vi.mocked(sendEmail).mockRejectedValue(new Error("unavailable"));
      const result = await runInvoiceAging(
        stubInvoices([invoice(31)]).client,
        NOW,
      );
      expect(result).toEqual({
        overdue: 1,
        over7: 1,
        over14: 1,
        over30: 1,
        emailSent: false,
      });
      expect(logToDatadog).toHaveBeenCalledWith(
        "warn",
        "Invoice aging email failed",
      );
    },
  );

  it("does not send a misleading report when the database read fails", async () => {
    await expect(
      runInvoiceAging(stubInvoices([], true).client, NOW),
    ).rejects.toThrow("query failed");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
