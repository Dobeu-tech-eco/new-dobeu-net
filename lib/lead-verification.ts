/**
 * Opaque, expiring tokens for double opt-in lead confirmation.
 * Token = base64url(iv[12] | ciphertext | tag[16]); the payload is
 * deflated then encrypted with AES-256-GCM (the auth tag provides integrity),
 * so no submitter PII is readable from the link. Server-only.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";

export const LEAD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const MIN_SECRET_LENGTH = 32;
const MAX_FUTURE_SKEW_MS = 60_000;
const IV_LEN = 12;
const TAG_LEN = 16;

export interface LeadTokenPayload {
  email: string;
  name: string | null;
  company: string | null;
  message: string | null;
  source: "book" | "form" | "email" | "typeform" | "other";
  utm: Record<string, string>;
  referrer: string | null;
  ipHash: string | null;
  iat: number;
  nonce: string;
}

export type LeadTokenInput = Omit<LeadTokenPayload, "iat" | "nonce">;

export type VerifyResult =
  | { ok: true; payload: LeadTokenPayload }
  | { ok: false; reason: "invalid" | "expired" };

/** True when the secret is long enough to derive a key from. */
export function isLeadSecretUsable(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", "lead-verify-enc", 32));
}

export function signLeadToken(input: LeadTokenInput, secret: string, nowMs: number): string {
  if (!isLeadSecretUsable(secret)) throw new Error("lead_secret_too_short");
  const payload: LeadTokenPayload = { ...input, iat: nowMs, nonce: randomBytes(16).toString("hex") };
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ct = Buffer.concat([cipher.update(deflateRawSync(JSON.stringify(payload))), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]).toString("base64url");
}

export function verifyLeadToken(token: string, secret: string, nowMs: number): VerifyResult {
  const invalid = { ok: false, reason: "invalid" } as const;
  if (typeof token !== "string" || !isLeadSecretUsable(secret)) return invalid;
  const raw = Buffer.from(token, "base64url");
  if (raw.length < IV_LEN + TAG_LEN + 1) return invalid;

  let payload: LeadTokenPayload;
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), raw.subarray(0, IV_LEN));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_LEN));
    const plain = Buffer.concat([
      decipher.update(raw.subarray(IV_LEN, raw.length - TAG_LEN)),
      decipher.final()
    ]);
    payload = JSON.parse(inflateRawSync(plain, { maxOutputLength: 64 * 1024 }).toString("utf8"));
  } catch {
    return invalid;
  }
  if (
    !payload ||
    typeof payload.email !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.iat !== "number"
  ) {
    return invalid;
  }
  if (payload.iat > nowMs + MAX_FUTURE_SKEW_MS) return invalid;
  if (nowMs - payload.iat > LEAD_TOKEN_TTL_MS) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
