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
 * The GoTrue PKCE flow-state lifetime, measured locally: codes were rejected
 * after 6 min with `flow_state_expired`. A sign-in timestamp is the
 * code-exchange time, which can trail the email send by up to the OTP lifetime
 * plus this grace.
 */
export const LINK_EXCHANGE_GRACE_SECONDS = 300;

/** Quiet window an email change must precede a link sign-in by. */
export const EMAIL_CHANGE_WINDOW_SECONDS =
  EMAIL_CHANGE_QUIET_SECONDS + LINK_EXCHANGE_GRACE_SECONDS;

/**
 * An identity whose `updated_at` is within this many seconds of its
 * `created_at` is treated as a pure creation, not a change.
 */
const IDENTITY_CREATION_SLACK_SECONDS = 2;

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

export type ProofIdentity = {
  provider?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

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
 * The email identity's `updated_at` as a change signal, in whole seconds:
 * `{ created, updated }` when both parse, else null (missing identity or an
 * unparseable value, which callers treat as fail closed). `changedAt` is
 * `updated` when it is more than 2 s after `created` (the identity was
 * modified after creation), otherwise null (a pure creation).
 */
export function identityEmailChangedAt(
  identities: ReadonlyArray<ProofIdentity> | null | undefined,
): { updated: number; changedAt: number | null } | "invalid" {
  const identity = identities?.find((i) => i.provider === "email");
  const created = toSeconds(identity?.created_at);
  const updated = toSeconds(identity?.updated_at);
  if (created === null || updated === null) return "invalid";
  return {
    updated,
    changedAt: updated > created + IDENTITY_CREATION_SLACK_SECONDS ? updated : null,
  };
}

/**
 * True iff no email change could have redirected the link that signed in at
 * `linkTs`. Fails closed: any missing or unparseable value is false. All of:
 *  (a) `emailChangeSentAt` is empty, or at least EMAIL_CHANGE_WINDOW_SECONDS
 *      before `linkTs`;
 *  (b) the provider=email identity exists with parseable created_at and
 *      updated_at;
 *  (c) the identity was not updated after `linkTs`;
 *  (d) if the identity was changed after creation, that change is at least
 *      EMAIL_CHANGE_WINDOW_SECONDS before `linkTs`.
 * Rule (d) exists because a password change clears `email_change_sent_at`
 * (config `secure_password_change = false`) but does NOT touch the email
 * identity's `updated_at`, which stays at the time the email change was
 * confirmed. Assumptions: manual identity linking stays disabled
 * (config.toml `enable_manual_linking = false`) and anonymous sign-ins stay
 * disabled, so the email identity cannot be re-created to reset `created_at`.
 */
export function emailChangeQuiet(input: {
  emailChangeSentAt?: string | null;
  identities: ReadonlyArray<ProofIdentity> | null | undefined;
  linkTs: number;
}): boolean {
  const cutoff = input.linkTs - EMAIL_CHANGE_WINDOW_SECONDS;
  if (input.emailChangeSentAt) {
    const requested = toSeconds(input.emailChangeSentAt);
    if (requested === null || requested > cutoff) return false;
  }
  const identity = identityEmailChangedAt(input.identities);
  if (identity === "invalid") return false;
  if (identity.updated > input.linkTs) return false;
  if (identity.changedAt !== null && identity.changedAt > cutoff) return false;
  return true;
}
