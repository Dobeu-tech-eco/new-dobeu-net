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
import {
  EMAIL_CHANGE_QUIET_SECONDS,
  emailChangeQuiet,
  latestLinkTimestamp,
  toSeconds,
  type SessionMethod,
} from "@/lib/mailbox-proof";

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

type AuthClient = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: (MarkerUser & { id: string }) | null;
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

/**
 * After a SUCCESSFUL code exchange or OTP verify: if the session was created by
 * an email-link method, stamp the account. Never throws and never affects the
 * caller's redirect.
 *
 * The marker is written only when an email change cannot have redirected the
 * link (`emailChangeQuiet`): a code's sign-in timestamp is the exchange time,
 * not the send time, so instead of ordering against send timestamps we require
 * that no change was requested in the 24 h before the sign-in (GoTrue's
 * maximum link lifetime) and the email identity was not touched after it.
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

    const linkTs = latestLinkTimestamp(data.currentAuthenticationMethods);
    if (linkTs === null) return;
    if (
      !emailChangeQuiet({
        emailChangeSentAt: user.email_change_sent_at,
        identities: user.identities,
        linkTs,
      })
    ) {
      console.warn("[email-link-signin] marker skipped: recent email change");
      return;
    }

    const marker: EmailLinkMarker = {
      at: new Date(linkTs * 1000).toISOString(),
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
 * email change was requested within the quiet period before the marker
 * (`email_change_sent_at` null, or at least EMAIL_CHANGE_QUIET_SECONDS earlier).
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
  if (user.email_change_sent_at) {
    const changeSentAt = toSeconds(user.email_change_sent_at);
    if (changeSentAt === null) return false;
    if (changeSentAt > markerAt - EMAIL_CHANGE_QUIET_SECONDS) return false;
  }
  return identityAt <= markerAt;
}
