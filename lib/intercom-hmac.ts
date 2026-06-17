import { createHmac } from "node:crypto";

/**
 * Compute the Intercom Identity Verification hash for a user.
 *
 * Intercom hashes the identifier you send it. We send `user_id` (the Supabase
 * UUID) from both portal + admin layouts, so we HMAC that same value.
 *
 * Server-only (`node:crypto`). Kept SEPARATE from `lib/intercom.ts` because
 * that module is intentionally importable from the client; crypto must never
 * reach the client bundle.
 *
 * Returns `undefined` when `INTERCOM_IDENTITY_VERIFICATION_SECRET` is unset so
 * the caller boots Intercom unverified (dev / pre-provisioning) without throwing.
 */
export function intercomUserHash(userId: string): string | undefined {
  const secret = process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET;
  if (!secret) return undefined;
  return createHmac("sha256", secret).update(userId).digest("hex");
}
