/**
 * Apollo.io API wrapper — server-only.
 * Used by /api/lead and /api/book to upsert contacts and log activities.
 *
 * Apollo docs: https://docs.apollo.io/reference
 */

const APOLLO_BASE = "https://api.apollo.io/api/v1";

interface ApolloContactInput {
  email: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  title?: string;
  phone?: string;
  // Apollo allows arbitrary labels (lead source, UTMs, etc.)
  label_names?: string[];
}

interface ApolloApiResult {
  ok: boolean;
  contact_id?: string;
  raw?: unknown;
  error?: string;
}

function apolloKey(): string {
  const k = process.env.APOLLO_API_KEY;
  if (!k) throw new Error("APOLLO_API_KEY missing");
  return k;
}

/**
 * Upsert (search-then-create-or-update) an Apollo contact.
 * Returns the Apollo contact id so it can be stored on the Supabase lead row.
 */
export async function upsertApolloContact(input: ApolloContactInput): Promise<ApolloApiResult> {
  try {
    const splitName = (input.first_name || input.last_name)
      ? { first_name: input.first_name, last_name: input.last_name }
      : splitDisplayName(undefined);

    const body = {
      first_name: splitName.first_name ?? "",
      last_name: splitName.last_name ?? "",
      email: input.email,
      organization_name: input.organization_name,
      title: input.title,
      phone_numbers: input.phone ? [{ raw_number: input.phone }] : undefined,
      label_names: input.label_names
    };

    const existing = await findApolloContactByEmail(input.email);
    if (existing?.id) {
      // Best-effort patch to avoid duplicate contacts when this email already exists.
      await patchApolloContact(existing.id, body);
      return { ok: true, contact_id: existing.id, raw: existing };
    }

    const res = await apolloRequest("/contacts", "POST", body);

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Apollo upsert failed: ${res.status} ${text}` };
    }

    const data = (await res.json()) as { contact?: { id?: string } };
    return { ok: true, contact_id: data.contact?.id, raw: data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

interface ApolloContactSearchResult {
  id?: string;
}

async function findApolloContactByEmail(email: string): Promise<ApolloContactSearchResult | null> {
  const candidates = ["/contacts/search", "/mixed_people/search"];
  for (const endpoint of candidates) {
    try {
      const res = await apolloRequest(endpoint, "POST", { q_keywords: email, page: 1, per_page: 1 });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        contacts?: Array<{ id?: string; email?: string }>;
        people?: Array<{ id?: string; email?: string }>;
      };
      const match =
        data.contacts?.find((c) => c.email?.toLowerCase() === email.toLowerCase()) ??
        data.people?.find((p) => p.email?.toLowerCase() === email.toLowerCase());
      if (match?.id) return { id: match.id };
    } catch {
      // Non-fatal; we'll fall back to create.
    }
  }
  return null;
}

async function patchApolloContact(contactId: string, payload: Record<string, unknown>): Promise<void> {
  const candidates = [`/contacts/${contactId}`, `/contacts/${contactId}/update`];
  for (const endpoint of candidates) {
    try {
      const res = await apolloRequest(endpoint, "PATCH", payload);
      if (res.ok) return;
    } catch {
      // keep trying
    }
  }
}

function apolloRequest(path: string, method: string, body?: unknown): Promise<Response> {
  return fetch(`${APOLLO_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apolloKey()
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

/**
 * Log a custom activity on an Apollo contact (e.g., "booked discovery call").
 */
export async function logApolloActivity(
  contactId: string,
  note: string,
  activityType = "note"
): Promise<ApolloApiResult> {
  try {
    const res = await fetch(`${APOLLO_BASE}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apolloKey()
      },
      body: JSON.stringify({
        contact_id: contactId,
        note: { content: note, type: activityType }
      })
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Apollo activity failed: ${res.status} ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function splitDisplayName(name?: string): { first_name?: string; last_name?: string } {
  if (!name) return {};
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}
