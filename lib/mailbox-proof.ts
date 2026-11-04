/**
 * Shared mailbox-proof helpers for the email-link marker
 * (`lib/email-link-signin.ts`) and the invite gate (`lib/company-invites.ts`).
 * Pure, isomorphic, no I/O.
 */

/**
 * GoTrue's maximum OTP/link lifetime is 86400 s, so any link usable at
 * sign-in time T was sent after T - 86400. If no email change was requested in
 * that window, the link went to the current address. The local config.toml
 * `otp_expiry` is 3600; this constant is deliberately the platform maximum so
 * a longer configured lifetime up to 24 h stays safe.
 */
export const EMAIL_CHANGE_QUIET_SECONDS = 86_400;

/**
 * Sign-in methods that prove control of the mailbox (not password or totp).
 * NOTE: `otp` is also emitted by phone/SMS OTP; the gate assumes phone
 * sign-in stays disabled (supabase/config.toml [auth.sms] enable_signup =
 * false; see D53).
 */
export const EMAIL_LINK_METHODS: ReadonlySet<string> = new Set([
  "otp",
  "magiclink",
  "invite",
  "email/signup",
]);

export type SessionMethod = { method: string; timestamp?: number } | string;

export type ProofIdentity = { provider?: string; updated_at?: string | null };

/** Whole seconds since the epoch (floored), or null if missing / unparseable. */
export function toSeconds(value: unknown): number | null {
  if (typeof value !== "string" || value === "") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/**
 * The newest numeric timestamp among email-link methods, or null. String
 * entries and entries without a finite numeric timestamp are ignored.
 */
export function latestLinkTimestamp(
  methods: ReadonlyArray<SessionMethod>,
): number | null {
  let latest: number | null = null;
  for (const m of methods) {
    if (typeof m === "string" || !EMAIL_LINK_METHODS.has(m.method)) continue;
    if (typeof m.timestamp !== "number" || !Number.isFinite(m.timestamp)) continue;
    if (latest === null || m.timestamp > latest) latest = m.timestamp;
  }
  return latest;
}

/**
 * True iff no email change could have redirected the link that signed in at
 * `linkTs`: no change was requested within the quiet window before it, and the
 * email identity exists and was not updated after it. Unparseable values fail
 * closed. An empty / null `emailChangeSentAt` means no change was ever made.
 */
export function emailChangeQuiet(input: {
  emailChangeSentAt?: string | null;
  identities: ReadonlyArray<ProofIdentity> | null | undefined;
  linkTs: number;
}): boolean {
  if (input.emailChangeSentAt) {
    const requested = toSeconds(input.emailChangeSentAt);
    if (requested === null) return false;
    if (requested > input.linkTs - EMAIL_CHANGE_QUIET_SECONDS) return false;
  }
  const identityAt = toSeconds(
    input.identities?.find((i) => i.provider === "email")?.updated_at,
  );
  return identityAt !== null && identityAt <= input.linkTs;
}
