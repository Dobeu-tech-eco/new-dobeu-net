import { getToken } from "@vercel/connect";

export { getToken };

export type ConnectSubject =
  | { type: "app" }
  | { type: "user"; id: string; issuer?: string };

/**
 * Fetch a scoped token from a Vercel Connect connector.
 *
 * Requires `VERCEL_OIDC_TOKEN` (injected on Vercel, or pulled locally via
 * `vercel env pull`). Register connectors with `vercel connect create <service>`
 * from the repo root while linked to the `new-dobeu-net` project.
 */
export async function getConnectToken(
  connector: string,
  subject: ConnectSubject = { type: "app" },
): Promise<string> {
  return getToken(connector, { subject });
}
