/**
 * Shared admin notice for an invoice that was created but not linked to its
 * work order. Used by the ticket Create button and the New Invoice dialog so
 * the manual remedy text stays in one place.
 */
export function linkFailedNotice(invoiceId: string | null): string {
  return invoiceId
    ? `Invoice ${invoiceId} was created but could not be linked to the work order. To link it, set work_orders.invoice_id = ${invoiceId} in Supabase, then reload this page. To bill again instead, void it in the Stripe dashboard (find it on /admin/invoices) and wait for the webhook to mark it void, then reload this page.`
    : "Invoice created but could not be linked to the work order. Set work_orders.invoice_id to that invoice in Supabase (find it on /admin/invoices), then reload this page.";
}
