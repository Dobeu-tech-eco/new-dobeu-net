import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import { LEAD_TOKEN_TTL_MS, isLeadSecretUsable, signLeadToken, verifyLeadToken } from "@/lib/lead-verification";

const input = {
  email: "a@b.com",
  name: "A",
  company: null,
  message: "hello",
  source: "form" as const,
  utm: {},
  referrer: null,
  ipHash: "ip_x"
};
const SECRET = "s".repeat(40);
const T = 1_700_000_000_000;

describe("lead tokens", () => {
  it("round-trips", () => {
    const r = verifyLeadToken(signLeadToken(input, SECRET, T), SECRET, T + 1000);
    expect(r.ok && r.payload).toMatchObject({ email: "a@b.com", iat: T });
    expect(r.ok && r.payload.nonce).toMatch(/^[0-9a-f]{32}$/);
  });
  it("is opaque: no PII visible in the token", () => {
    const t = signLeadToken(input, SECRET, T);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(t, "base64url").toString("latin1")).not.toContain("a@b.com");
  });
  it("rejects wrong secret, tampering, and malformed input", () => {
    const t = signLeadToken(input, SECRET, T);
    expect(verifyLeadToken(t, "o".repeat(40), T)).toEqual({ ok: false, reason: "invalid" });
    const raw = Buffer.from(t, "base64url");
    raw[20] ^= 1;
    expect(verifyLeadToken(raw.toString("base64url"), SECRET, T)).toEqual({ ok: false, reason: "invalid" });
    for (const bad of ["", "abc", "a.b.c", "."]) {
      expect(verifyLeadToken(bad, SECRET, T)).toEqual({ ok: false, reason: "invalid" });
    }
  });
  it("reports a future iat (>60s) as invalid, not expired", () => {
    const t = signLeadToken(input, SECRET, T + 120_000);
    expect(verifyLeadToken(t, SECRET, T)).toEqual({ ok: false, reason: "invalid" });
  });
  it("treats secrets under 32 chars as unusable", () => {
    expect(isLeadSecretUsable("short")).toBe(false);
    expect(isLeadSecretUsable(undefined)).toBe(false);
    expect(() => signLeadToken(input, "short", T)).toThrow();
    const t = signLeadToken(input, SECRET, T);
    expect(verifyLeadToken(t, "short", T)).toEqual({ ok: false, reason: "invalid" });
  });
  it("expires after 24h", () => {
    const t = signLeadToken(input, SECRET, T);
    expect(verifyLeadToken(t, SECRET, T + LEAD_TOKEN_TTL_MS).ok).toBe(true);
    expect(verifyLeadToken(t, SECRET, T + LEAD_TOKEN_TTL_MS + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a payload that inflates beyond 64KiB", () => {
    const iv = randomBytes(12);
    const key = Buffer.from(hkdfSync("sha256", SECRET, "", "lead-verify-enc", 32));
    const c = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([c.update(deflateRawSync("a".repeat(200_000))), c.final()]);
    const token = Buffer.concat([iv, ct, c.getAuthTag()]).toString("base64url");
    expect(verifyLeadToken(token, SECRET, T)).toEqual({ ok: false, reason: "invalid" });
  });
});
