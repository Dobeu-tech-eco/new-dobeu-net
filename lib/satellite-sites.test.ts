import { afterEach, describe, expect, it, vi } from "vitest";
import { SATELLITE_DEFINITIONS, parseSatelliteOrigin, resolveSatelliteSite, resolveSatelliteSites, type SatelliteEnv, type SatelliteSite } from "./satellite-sites";

const origin = "https://tutor.dobeu.net";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("satellite registry", () => {
  it.each([origin, `${origin}/`])("accepts %s", (raw) => {
    const env = { NEXT_PUBLIC_SATELLITE_TUTOR_URL: raw };
    expect(resolveSatelliteSites(env)).toEqual([{ id: "tutor", origin }]);
    expect(resolveSatelliteSite("tutor", env)).toEqual({ id: "tutor", origin });
  });
  it.each([
    undefined, "", ` ${origin}`, `${origin} `, `${origin}\n`, "https://tu\ttor.dobeu.net",
    "http://tutor.dobeu.net", "HTTPS://tutor.dobeu.net", "//tutor.dobeu.net", "tutor.dobeu.net", "javascript:alert(1)",
    "https://TUTOR.dobeu.net", "https://tut%6Fr.dobeu.net", "https://tutor。dobeu.net", "https://xn--tutr-0qa.dobeu.net",
    "https://user@tutor.dobeu.net", "https://user:pw@tutor.dobeu.net", "https://@tutor.dobeu.net", "https://tutor.dobeu.net@evil.example",
    "https://evil.example/tutor.dobeu.net", "https://tutor.dobeu.net.evil.example", "https://eviltutor.dobeu.net", "https://www.tutor.dobeu.net", "https://dobeu.net", `${origin}.`, "https://127.0.0.1", "https://[::1]",
    `${origin}:443`, // URL parsing alone would accept and erase this port.
    `${origin}:8443`, `${origin}:`, `${origin}/path`, `${origin}//`, `${origin}/?`, `${origin}?x=1`, `${origin}#`, `${origin}#frag`,
    "https:\\\\tutor.dobeu.net", `${origin}\\`,
  ])("rejects %j", (raw) => {
    const env = { NEXT_PUBLIC_SATELLITE_TUTOR_URL: raw };
    expect(resolveSatelliteSites(env)).toEqual([]);
    expect(resolveSatelliteSite("tutor", env)).toBeNull();
  });
  it.each(["https://staffing.dobeu.net", origin, "https://example.com", undefined])("keeps staffing disabled for %j", (raw) => {
    const env = { NEXT_PUBLIC_SATELLITE_STAFFING_URL: raw };
    expect(resolveSatelliteSites(env)).toEqual([]);
    expect(resolveSatelliteSite("staffing", env)).toBeNull();
    expect(parseSatelliteOrigin(raw, null)).toBeNull();
  });
  it("isolates slots and ignores unknown keys", () => {
    expect(resolveSatelliteSites({ NEXT_PUBLIC_SATELLITE_STAFFING_URL: origin })).toEqual([]);
    expect(resolveSatelliteSites({ NEXT_PUBLIC_SATELLITE_TUTOR_URL: origin, NEXT_PUBLIC_SATELLITE_STAFFING_URL: origin })).toEqual([{ id: "tutor", origin }]);
    expect(resolveSatelliteSites({ unknown: origin } as SatelliteEnv)).toEqual([]);
  });
  it.each([42, {}, null])("rejects runtime non-string %j", (raw) => {
    expect(() => resolveSatelliteSites({ NEXT_PUBLIC_SATELLITE_TUTOR_URL: raw } as unknown as SatelliteEnv)).not.toThrow();
    expect(resolveSatelliteSites({ NEXT_PUBLIC_SATELLITE_TUTOR_URL: raw } as unknown as SatelliteEnv)).toEqual([]);
  });
  it("reads only supplied configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SATELLITE_TUTOR_URL", origin);
    expect(resolveSatelliteSites({})).toEqual([]);
  });
  it("freezes results without mutating inputs", () => {
    const env = Object.freeze({ NEXT_PUBLIC_SATELLITE_TUTOR_URL: origin });
    const before = JSON.parse(JSON.stringify(env));
    const first = resolveSatelliteSites(env);
    const second = resolveSatelliteSites(env);
    expect(env).toEqual(before);
    expect(Object.isFrozen(SATELLITE_DEFINITIONS)).toBe(true);
    for (const def of SATELLITE_DEFINITIONS) expect(Object.isFrozen(def)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    for (const site of first) expect(Object.isFrozen(site)).toBe(true);
    expect(() => (first as SatelliteSite[]).push({ id: "tutor", origin })).toThrow(TypeError);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
  it("silently rejects invalid configuration", () => {
    const spies = (["warn", "error", "log"] as const).map((method) => vi.spyOn(console, method));
    for (const raw of ["invalid", `${origin}:443`, "https://user@tutor.dobeu.net", `${origin}/path`, "https://tutor。dobeu.net"]) {
      expect(resolveSatelliteSites({ NEXT_PUBLIC_SATELLITE_TUTOR_URL: raw })).toEqual([]);
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
