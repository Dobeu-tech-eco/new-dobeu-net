/**
 * Forward-only invoice status.
 *
 * open (0) → overdue (1) → paid or void (2).
 *
 * `paid` and `void` share the top rank, so neither replaces the other. A late
 * or replayed `invoice.payment_failed` therefore cannot move a paid invoice
 * back to overdue, and a duplicate of the current status matches nothing.
 */
import type { Database } from "@/lib/database.types";

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

const INVOICE_STATUS_RANK = {
  open: 0,
  overdue: 1,
  paid: 2,
  void: 2,
} as const satisfies Record<InvoiceStatus, number>;

/** Statuses a row may already have when `target` is allowed to replace it. */
export function invoiceStatusesBefore(target: InvoiceStatus): InvoiceStatus[] {
  const ceiling = INVOICE_STATUS_RANK[target];
  return (Object.keys(INVOICE_STATUS_RANK) as InvoiceStatus[]).filter(
    (status) => INVOICE_STATUS_RANK[status] < ceiling,
  );
}
