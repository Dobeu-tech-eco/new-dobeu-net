/**
 * Stripe server-side wrapper. Server-only — never import from a Client Component.
 *
 * Surface:
 *  - getStripe()         : lazy Stripe client (throws if STRIPE_SECRET_KEY missing)
 *  - isStripeConfigured(): boolean gate, mirrors lib/apollo / lib/customerio
 *  - upsertStripeCustomer({ email, name }) : idempotent by email
 *  - createHostedInvoice({ customerId, amountCents, currency, description, dueDays })
 *      → { invoiceId, hostedUrl, status }
 *  - verifyWebhook(rawBody, signatureHeader) → Stripe.Event | null
 *
 * All calls return a `{ ok, ... } | { ok: false, error }` shape so callers in
 * the lead/admin flows can fan out best-effort without bringing the whole
 * pipeline down on a transient Stripe failure (same pattern as lib/apollo.ts).
 */
import Stripe from "stripe";

const API_VERSION = "2024-12-18.acacia" as Stripe.LatestApiVersion;

let _client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing — cannot use Stripe.");
  _client = new Stripe(key, { apiVersion: API_VERSION });
  return _client;
}

interface UpsertCustomerInput {
  email: string;
  name?: string | null;
  metadata?: Record<string, string>;
}

interface UpsertCustomerResult {
  ok: boolean;
  customerId?: string;
  error?: string;
}

/**
 * Find-or-create a Stripe customer by email. Stripe doesn't dedupe on email,
 * so we search first (`Search API` requires a query field), and only create
 * when no match exists.
 */
export async function upsertStripeCustomer(input: UpsertCustomerInput): Promise<UpsertCustomerResult> {
  try {
    if (!isStripeConfigured()) return { ok: false, error: "not_configured" };
    const stripe = getStripe();
    const search = await stripe.customers.search({
      query: `email:'${input.email.replace(/'/g, "")}'`,
      limit: 1
    });
    if (search.data.length > 0) {
      const existing = search.data[0]!;
      if (input.name || input.metadata) {
        await stripe.customers.update(existing.id, {
          ...(input.name ? { name: input.name } : {}),
          ...(input.metadata ? { metadata: input.metadata } : {})
        });
      }
      return { ok: true, customerId: existing.id };
    }
    const created = await stripe.customers.create({
      email: input.email,
      ...(input.name ? { name: input.name } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {})
    });
    return { ok: true, customerId: created.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

interface CreateHostedInvoiceInput {
  customerId: string;
  amountCents: number;
  currency?: string;
  description?: string;
  dueDays?: number;
  metadata?: Record<string, string>;
}

interface CreateHostedInvoiceResult {
  ok: boolean;
  invoiceId?: string;
  hostedUrl?: string | null;
  status?: Stripe.Invoice.Status;
  error?: string;
}

/**
 * Create a one-off Stripe Invoice with a single line item, finalize it so the
 * hosted_invoice_url is available, and return both. We store the URL on our
 * own `invoices.hosted_invoice_url` so the portal "Pay" button never has to
 * hand-build a URL again.
 */
export async function createHostedInvoice(input: CreateHostedInvoiceInput): Promise<CreateHostedInvoiceResult> {
  try {
    if (!isStripeConfigured()) return { ok: false, error: "not_configured" };
    const stripe = getStripe();
    const currency = (input.currency ?? "usd").toLowerCase();
    const dueDays = input.dueDays ?? 14;

    const invoice = await stripe.invoices.create({
      customer: input.customerId,
      collection_method: "send_invoice",
      days_until_due: dueDays,
      ...(input.description ? { description: input.description } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {})
    });

    await stripe.invoiceItems.create({
      customer: input.customerId,
      invoice: invoice.id,
      amount: input.amountCents,
      currency,
      ...(input.description ? { description: input.description } : {})
    });

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

    return {
      ok: true,
      invoiceId: finalized.id,
      hostedUrl: finalized.hosted_invoice_url ?? null,
      status: finalized.status ?? undefined
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Verify a Stripe webhook signature against the raw body. Returns the parsed
 * event or null on any failure. Callers MUST pass the unparsed request body.
 */
export function verifyWebhook(rawBody: string, signatureHeader: string | null): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;
  try {
    return getStripe().webhooks.constructEvent(rawBody, signatureHeader, secret);
  } catch {
    return null;
  }
}
