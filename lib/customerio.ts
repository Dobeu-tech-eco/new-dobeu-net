/**
 * Customer.io server-side track API wrapper.
 * Used by /api/lead to identify the contact and fire a "lead_captured" event,
 * which kicks off the welcome / nurture sequence in Customer.io.
 *
 * Docs: https://docs.customer.io/api/track/
 */

const CIO_BASE = "https://track.customer.io/api/v1";

interface CioIdentifyInput {
  email: string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
}

interface CioEventInput {
  email: string;
  name: string;
  data?: Record<string, string | number | boolean | null | undefined>;
}

function authHeader(): string {
  const siteId = process.env.CUSTOMERIO_SITE_ID;
  const apiKey = process.env.CUSTOMERIO_API_KEY;
  if (!siteId || !apiKey) {
    throw new Error("CUSTOMERIO_SITE_ID and CUSTOMERIO_API_KEY required");
  }
  return "Basic " + Buffer.from(`${siteId}:${apiKey}`).toString("base64");
}

export function isCustomerIoConfigured(): boolean {
  return Boolean(
    process.env.CUSTOMERIO_SITE_ID && process.env.CUSTOMERIO_API_KEY,
  );
}

/**
 * Identify a customer in Customer.io. Uses the email as the customer id.
 */
export async function cioIdentify(
  input: CioIdentifyInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isCustomerIoConfigured())
      return { ok: false, error: "not_configured" };
    const id = encodeURIComponent(input.email);
    const res = await fetch(`${CIO_BASE}/customers/${id}`, {
      method: "PUT",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        ...(input.attributes ?? {}),
        last_identified_at: Math.floor(Date.now() / 1000),
      }),
    });
    if (!res.ok)
      return {
        ok: false,
        error: `Customer.io identify ${res.status}: ${await res.text()}`,
      };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Fire a Customer.io event on a customer. Goes through the customer.io workflow engine,
 * which can trigger campaigns / drips off this event.
 */
export async function cioTrack(
  input: CioEventInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isCustomerIoConfigured())
      return { ok: false, error: "not_configured" };
    const id = encodeURIComponent(input.email);
    const res = await fetch(`${CIO_BASE}/customers/${id}/events`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        data: input.data ?? {},
        timestamp: Math.floor(Date.now() / 1000),
      }),
    });
    if (!res.ok)
      return {
        ok: false,
        error: `Customer.io track ${res.status}: ${await res.text()}`,
      };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
