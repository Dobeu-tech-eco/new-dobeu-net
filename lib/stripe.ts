/**
 * Stripe server-side client (Phase 3).
 *
 * Locked Phase 3 decisions:
 *  - Stripe-hosted invoices: admin creates the invoice via API; Stripe sends
 *    the payment-link email; webhook flips local `invoices.status`.
 *  - Customer mapping: `profiles.stripe_customer_id` (lazy-created). On first
 *    invoice we search Stripe by email (covers customers created in the dashboard
 *    before this app shipped), then create if no match. The id is stored back
 *    to the profile and reused for every subsequent invoice.
 *
 * Server-only. All callers go through `getStripe()` so the SDK is initialised
 * exactly once per process and the secret never leaks into a client bundle.
 *
 * Pinned API version: `2024-12-18.acacia` — matches the typings shipped with
 * `stripe@17.x`. Bumping the API requires both an SDK upgrade and a manual
 * dashboard upgrade.
 */
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

// Pinned to the SDK's `LatestApiVersion` to keep TypeScript happy. The
// installed `stripe@17.7.0` ships typings tied to `2025-02-24.acacia`; if you
// upgrade the SDK, re-pin this to the new `LatestApiVersion` on purpose
// (don't drift -- a Stripe API bump requires a dashboard upgrade too).
const STRIPE_API_VERSION = "2025-02-24.acacia" as const;

let _stripe: Stripe | null = null;

/**
 * Singleton lazy-loaded Stripe client. Throws if `STRIPE_SECRET_KEY` is unset
 * at call time (so build-time imports stay cheap).
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY missing — cannot create Stripe client.");
  }
  _stripe = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    appInfo: { name: "dobeu.net", url: "https://dobeu.net" }
  });
  return _stripe;
}

/** Test-only hook so the singleton can be reset between runs. */
export function __resetStripeForTests(): void {
  _stripe = null;
}

export interface GetOrCreateCustomerArgs {
  supabaseUserId: string;
  email: string;
  name?: string | null;
}

/**
 * Resolve a Stripe customer for the given Supabase user. Idempotent:
 *   1. Read `profiles.stripe_customer_id`. If set, return it.
 *   2. Search Stripe by email (covers dashboard-created customers).
 *   3. Otherwise create a new Stripe customer.
 *   4. Persist the id back to the profile.
 *
 * Steps 2-4 only fire on the first invoice per user — subsequent invoices
 * hit the cached id in step 1.
 *
 * `stripe.customers.search` requires the search API to be enabled on the
 * account (it is by default for modern accounts). If it 404s for legacy
 * accounts, we fall back to `customers.list({ email })`.
 */
export async function upsertStripeCustomer(
  input: UpsertCustomerInput,
): Promise<UpsertCustomerResult> {
  try {
    const search = await stripe.customers.search({
      query: `email:'${input.email.replace(/'/g, "")}'`,
      limit: 1,
    });
    if (search.data.length > 0) {
      const existing = search.data[0]!;
      if (input.name || input.metadata) {
        await stripe.customers.update(existing.id, {
          ...(input.name ? { name: input.name } : {}),
          ...(input.metadata ? { metadata: input.metadata } : {}),
        });
      }
      return { ok: true, customerId: existing.id };
    }
    const created = await stripe.customers.create({
      email: input.email,
      ...(input.name ? { name: input.name } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
    return { ok: true, customerId: created.id };
  } catch (e) {
    // Search API may not be enabled on very old accounts; fall back to list.
    console.warn("[stripe] customers.search failed, falling back to list:", (e as Error).message);
    const list = await stripe.customers.list({ email, limit: 1 });
    existingId = list.data[0]?.id;
  }

  let customerId: string;
  if (existingId) {
    customerId = existingId;
  } else {
    // 3. Create.
    const created = await stripe.customers.create({
      email,
      name: resolvedName ?? undefined,
      metadata: { supabase_user_id: supabaseUserId }
    });
    customerId = created.id;
  }

  // 4. Persist back to profile (admin client bypasses RLS).
  const { error: writeErr } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", supabaseUserId);
  if (writeErr) {
    // Don't throw -- the Stripe id is still resolvable on the next call.
    // Surface so it shows up in Vercel logs / Datadog.
    console.error(
      `[stripe] failed to persist stripe_customer_id=${customerId} for profile=${supabaseUserId}:`,
      writeErr.message
    );
  }

  return customerId;
}

export interface CreateHostedInvoiceArgs {
  customerId: string;
  amountCents: number;
  description?: string | null;
  currency?: string;
  metadata?: Record<string, string | undefined>;
  /**
   * Days until the hosted invoice is due. Stripe rejects > 30 for `send_invoice`
   * collection on some accounts; we cap at 60 as a sanity bound.
   */
  daysUntilDue?: number;
}

export interface CreatedHostedInvoice {
  id: string;
  hosted_invoice_url: string | null;
  status: Stripe.Invoice.Status | null;
}

/**
 * Create a Stripe-hosted invoice: invoice item → finalize → return URL.
 * `collection_method: 'send_invoice'` means Stripe emails the payment link
 * automatically.
 */
export async function createHostedInvoice(
  input: CreateHostedInvoiceInput,
): Promise<CreateHostedInvoiceResult> {
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
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });

    await stripe.invoiceItems.create({
      customer: input.customerId,
      invoice: invoice.id,
      amount: input.amountCents,
      currency,
      ...(input.description ? { description: input.description } : {}),
    });

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

    return {
      ok: true,
      invoiceId: finalized.id,
      hostedUrl: finalized.hosted_invoice_url ?? null,
      status: finalized.status ?? undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const stripe = getStripe();

  // Stripe metadata values must be strings. Drop undefineds.
  const cleanMeta: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata ?? {})) {
    if (typeof v === "string" && v.length > 0) cleanMeta[k] = v;
  }

  // 1. Create draft invoice.
  const draft = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: Math.max(1, Math.min(60, daysUntilDue)),
    description: description ?? undefined,
    metadata: cleanMeta,
    auto_advance: false
  });
  if (!draft.id) {
    throw new Error("createHostedInvoice: Stripe returned invoice with no id");
  }

  // 2. Attach the invoice item to that draft.
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: draft.id,
    amount: amountCents,
    currency,
    description: description ?? undefined
  });

  // 3. Finalize → returns the hosted_invoice_url.
  const finalized = await stripe.invoices.finalizeInvoice(draft.id);

  return {
    id: finalized.id ?? draft.id,
    hosted_invoice_url: finalized.hosted_invoice_url ?? null,
    status: finalized.status ?? null
  };
}

/**
 * Verify a Stripe webhook signature and return the parsed event.
 * Throws on any signature mismatch — callers should turn that into a 400.
 *
 * `rawBody` MUST be the raw request body (not parsed JSON), otherwise the
 * HMAC will not match.
 */
export function verifyWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return null;
  try {
    return getStripe().webhooks.constructEvent(
      rawBody,
      signatureHeader,
      secret,
    );
  } catch {
    return null;
  }
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);
}
