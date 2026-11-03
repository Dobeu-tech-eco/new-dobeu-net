/**
 * Only render Pay links that point at Stripe's hosted invoice host over https.
 */
export function safeStripeInvoiceUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "invoice.stripe.com" ? u.toString() : null;
  } catch {
    return null;
  }
}
