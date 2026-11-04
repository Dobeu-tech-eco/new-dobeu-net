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
}

type AuthClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string; email?: string | null } | null };
    }>;
    mfa: {
      getAuthenticatorAssuranceLevel: () => Promise<{
        data: {
          currentAuthenticationMethods: ReadonlyArray<string | { method: string }>;
        } | null;
        error: unknown;
      }>;
    };
  };
};

/**
 * After a SUCCESSFUL code exchange or OTP verify: if the session was created by
 * an email-link method, stamp the account. Never throws and never affects the
 * caller's redirect.
 */
export async function recordEmailLinkSignIn(supabase: unknown): Promise<void> {
  try {
    const client = supabase as AuthClient;
    const { data: userData } = await client.auth.getUser();
    const user = userData?.user;
    if (!user?.email) return;
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return;
    const viaLink = data.currentAuthenticationMethods.some((m) =>
      EMAIL_LINK_METHODS.has(typeof m === "string" ? m : m.method),
    );
    if (!viaLink) return;
    const marker: EmailLinkMarker = {
      at: new Date().toISOString(),
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

function toSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/**
 * True iff the account's current email was proven by an email-link sign-in: the
 * marker's email equals the current email (case-insensitive) and the email
 * identity was not updated after the marker (second precision, `<=`).
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
  return identityAt <= markerAt;
}
