/**
 * Attach-time squatter guard. Records, in the user's `app_metadata`, when the
 * account last signed in through an emailed link (proof of the mailbox), so
 * `inviteMember` can later tell whether an existing account's CURRENT email
 * was proven. Server-only; deliberately not a "use server" module.
 *
 * `app_metadata` is only writable with the service role, so a user cannot forge
 * the marker. GoTrue merges top-level `app_metadata` keys on admin update, so
 * only the one key is sent (no read-modify-write of the whole object).
 */
import { createAdminClient } from "@/lib/supabase/server";
import { safeErrorFields } from "@/lib/log-safe";

/** Sign-in methods that prove control of the mailbox (not password or totp). */
const EMAIL_LINK_METHODS: ReadonlySet<string> = new Set([
  "otp",
  "magiclink",
  "invite",
  "email/signup",
]);

export interface EmailLinkMarker {
  at: string;
  email: string;
}

/** The slice of a Supabase auth user this module reads. */
export interface MarkerUser {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  identities?: ReadonlyArray<{ provider?: string; updated_at?: string | null }> | null;
  email_change_sent_at?: string | null;
}

type SessionMethod = string | { method: string; timestamp?: number };

type AuthClient = {
  auth: {
    getUser: () => Promise<{
      data: {
        user:
          | (MarkerUser & {
              id: string;
              recovery_sent_at?: string | null;
              confirmation_sent_at?: string | null;
            })
          | null;
      };
    }>;
    mfa: {
      getAuthenticatorAssuranceLevel: () => Promise<{
        data: {
          currentAuthenticationMethods: ReadonlyArray<SessionMethod>;
        } | null;
        error: unknown;
      }>;
    };
  };
};

function toSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/**
 * After a SUCCESSFUL code exchange or OTP verify: if the session was created by
 * an email-link method, stamp the account. Never throws and never affects the
 * caller's redirect.
 *
 * The marker is written only when the link was requested AFTER the last email
 * change (otherwise a squatter could request a link for the old address, change
 * the email, and have the link sign-in vouch for an address it never proved):
 *  - linkSentAt = the later of `recovery_sent_at` (magic link / OTP for a
 *    confirmed user) and `confirmation_sent_at` (first link for an unconfirmed
 *    user) must exist;
 *  - `email_change_sent_at` must be null or earlier than linkSentAt;
 *  - the email identity's `updated_at` must be at most one second after
 *    linkSentAt (first-time confirmation may touch it just after the send).
 * `at` is the link method's own amr timestamp, not the wall clock.
 */
export async function recordEmailLinkSignIn(supabase: unknown): Promise<void> {
  try {
    const client = supabase as AuthClient;
    const { data: userData } = await client.auth.getUser();
    const user = userData?.user;
    if (!user?.email) return;
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return;

    let linkAt: number | null = null;
    for (const m of data.currentAuthenticationMethods) {
      if (typeof m === "string" || !EMAIL_LINK_METHODS.has(m.method)) continue;
      if (typeof m.timestamp !== "number" || !Number.isFinite(m.timestamp)) continue;
      if (linkAt === null || m.timestamp > linkAt) linkAt = m.timestamp;
    }
    if (linkAt === null) return;

    const sentAt = [user.recovery_sent_at, user.confirmation_sent_at]
      .map(toSeconds)
      .filter((v): v is number => v !== null);
    const linkSentAt = sentAt.length > 0 ? Math.max(...sentAt) : null;
    const changeSentAt = toSeconds(user.email_change_sent_at);
    const identityAt = toSeconds(user.identities?.find((i) => i.provider === "email")?.updated_at);
    if (
      linkSentAt === null ||
      (changeSentAt !== null && changeSentAt >= linkSentAt) ||
      identityAt === null ||
      identityAt > linkSentAt + 1
    ) {
      console.warn("[email-link-signin] marker skipped: link not newer than the last email change");
      return;
    }

    const marker: EmailLinkMarker = {
      at: new Date(linkAt * 1000).toISOString(),
      email: user.email,
    };
    const { error: updateErr } = await createAdminClient().auth.admin.updateUserById(
      user.id,
      { app_metadata: { email_link_signin: marker } },
    );
    if (updateErr) {
      console.warn("[email-link-signin] marker write failed:", safeErrorFields(updateErr));
    }
  } catch (e) {
    console.warn("[email-link-signin] record failed:", safeErrorFields(e));
  }
}

/**
 * True iff the account's current email was proven by an email-link sign-in: the
 * marker's email equals the current email (case-insensitive) and the email
 * identity was not updated after the marker (second precision, `<=`), and no
 * email change was requested after the marker.
 */
export function hasCurrentEmailLinkSignIn(user: MarkerUser): boolean {
  const raw = user.app_metadata?.email_link_signin;
  if (!raw || typeof raw !== "object") return false;
  const { at, email } = raw as Partial<EmailLinkMarker>;
  if (typeof email !== "string" || typeof user.email !== "string") return false;
  if (email.toLowerCase() !== user.email.toLowerCase()) return false;
  const markerAt = toSeconds(at);
  if (markerAt === null) return false;
  const identity = user.identities?.find((i) => i.provider === "email");
  const identityAt = toSeconds(identity?.updated_at);
  if (identityAt === null) return false;
  const changeSentAt = toSeconds(user.email_change_sent_at);
  if (changeSentAt !== null && changeSentAt > markerAt) return false;
  return identityAt <= markerAt;
}
