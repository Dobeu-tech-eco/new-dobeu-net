import { describe, expect, it } from "vitest";
import {
  invoiceStatusesBefore,
  type InvoiceStatus,
} from "@/lib/invoice-status";

const STATUSES = [
  "open",
  "overdue",
  "paid",
  "void",
] as const satisfies readonly InvoiceStatus[];

describe("invoiceStatusesBefore", () => {
  it("ranks open below overdue, and paid and void as the same terminal rank", () => {
    expect(invoiceStatusesBefore("open")).toEqual([]);
    expect(invoiceStatusesBefore("overdue")).toEqual(["open"]);
    expect(invoiceStatusesBefore("paid")).toEqual(["open", "overdue"]);
    expect(invoiceStatusesBefore("void")).toEqual(["open", "overdue"]);
  });

  it("never lists a status as a predecessor of itself", () => {
    for (const status of STATUSES) {
      expect(invoiceStatusesBefore(status)).not.toContain(status);
    }
  });

  it("does not let paid move to overdue or trade places with void", () => {
    expect(invoiceStatusesBefore("overdue")).not.toContain("paid");
    expect(invoiceStatusesBefore("overdue")).not.toContain("void");
    expect(invoiceStatusesBefore("paid")).not.toContain("void");
    expect(invoiceStatusesBefore("void")).not.toContain("paid");
  });
});
