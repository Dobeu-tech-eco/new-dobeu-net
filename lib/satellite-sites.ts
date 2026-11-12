export type SatelliteId = "tutor" | "staffing";
export type SatelliteEnvKey =
  | "NEXT_PUBLIC_SATELLITE_TUTOR_URL"
  | "NEXT_PUBLIC_SATELLITE_STAFFING_URL";
export interface SatelliteDefinition {
  readonly id: SatelliteId;
  readonly envKey: SatelliteEnvKey;
  readonly approvedHost: string | null;
}
export interface SatelliteSite {
  readonly id: SatelliteId;
  readonly origin: string;
}
export type SatelliteEnv = Readonly<Partial<Record<SatelliteEnvKey, string | undefined>>>;

export const SATELLITE_DEFINITIONS: readonly SatelliteDefinition[] = Object.freeze([
  Object.freeze({ id: "tutor", envKey: "NEXT_PUBLIC_SATELLITE_TUTOR_URL", approvedHost: "tutor.dobeu.net" } as const),
  Object.freeze({ id: "staffing", envKey: "NEXT_PUBLIC_SATELLITE_STAFFING_URL", approvedHost: null } as const),
]);

/**
 * Accept only canonical HTTPS spellings. Explicit :443 is rejected even though
 * URL parsing drops that port; returned origins never carry a port.
 */
export function parseSatelliteOrigin(raw: unknown, approvedHost: string | null): string | null {
  if (approvedHost === null || typeof raw !== "string" || raw === "") return null;
  if (/[^\x21-\x7E]|[\\@]/.test(raw)) return null;
  if (raw !== `https://${approvedHost}` && raw !== `https://${approvedHost}/`) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== approvedHost || url.port !== "" ||
        url.username !== "" || url.password !== "" || url.pathname !== "/" ||
        url.search !== "" || url.hash !== "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Resolve NEXT_PUBLIC_SATELLITE_TUTOR_URL and NEXT_PUBLIC_SATELLITE_STAFFING_URL.
 * Section 68 callers must pass literal process.env.NEXT_PUBLIC_SATELLITE_TUTOR_URL
 * and process.env.NEXT_PUBLIC_SATELLITE_STAFFING_URL reads in an object, never
 * process.env[key] or a destructured process.env. Local Next docs:
 * node_modules/next/dist/docs/01-app/02-guides/environment-variables.md says
 * "dynamic lookups will not be inlined". This module reads only the supplied env.
 */
export function resolveSatelliteSites(env: SatelliteEnv): readonly SatelliteSite[] {
  const sites: SatelliteSite[] = [];
  for (const def of SATELLITE_DEFINITIONS) {
    const origin = parseSatelliteOrigin(env[def.envKey], def.approvedHost);
    if (origin !== null) sites.push(Object.freeze({ id: def.id, origin }));
  }
  return Object.freeze(sites);
}

export function resolveSatelliteSite(id: SatelliteId, env: SatelliteEnv): SatelliteSite | null {
  return resolveSatelliteSites(env).find((site) => site.id === id) ?? null;
}
