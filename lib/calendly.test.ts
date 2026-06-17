import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyCalendlySignature, parseCalendlySignature, utmFromTracking } from "@/lib/calendly";

const KEY = "test-signing-key";

function sign(body: string, t: number, key = KEY): string {
  const v1 = createHmac("sha256", key).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("parseCalendlySignature", () => {
  it("parses t and v1 from the header", () => {
    expect(parseCalendlySignature("t=123,v1=abc")).toEqual({ t: "123", v1: "abc" });
  });
  it("returns null for missing parts or null input", () => {
    expect(parseCalendlySignature(null)).toBeNull();
    expect(parseCalendlySignature("t=123")).toBeNull();
  });
});

describe("verifyCalendlySignature", () => {
  const body = JSON.stringify({ event: "invitee.created", payload: { email: "a@b.com" } });

  it("accepts a correctly signed, fresh payload", () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyCalendlySignature(body, sign(body, t), KEY)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const t = Math.floor(Date.now() / 1000);
    const header = sign(body, t);
    expect(verifyCalendlySignature(body + "x", header, KEY)).toBe(false);
  });

  it("rejects a signature made with the wrong key", () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyCalendlySignature(body, sign(body, t, "other-key"), KEY)).toBe(false);
  });

  it("rejects a stale timestamp (replay guard)", () => {
    const old = Math.floor(Date.now() / 1000) - 10_000;
    expect(verifyCalendlySignature(body, sign(body, old), KEY)).toBe(false);
  });

  it("rejects a malformed header", () => {
    expect(verifyCalendlySignature(body, "garbage", KEY)).toBe(false);
    expect(verifyCalendlySignature(body, null, KEY)).toBe(false);
  });
});

describe("utmFromTracking", () => {
  it("maps present utm fields and drops nulls/undefined", () => {
    expect(
      utmFromTracking({ utm_source: "google", utm_medium: null, utm_campaign: "spring" })
    ).toEqual({ utm_source: "google", utm_campaign: "spring" });
  });
  it("returns empty object when tracking is absent", () => {
    expect(utmFromTracking(undefined)).toEqual({});
  });
});
