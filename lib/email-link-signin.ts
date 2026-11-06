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
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { safeErrorFields } from "@/lib/log-safe";
import {
  emailChangeQuiet,
  latestLinkTimestamp,
  toSeconds,
  type ProofIdentity,
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
  identities?: ReadonlyArray<ProofIdentity> | null;
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
 * caller's redirect: the work (an admin API write) is scheduled with
 * `after()` so it runs once the redirect response is sent, not before it.
 * The marker can therefore land a moment after the redirect. That is
 * acceptable: it is read only by `inviteMember`'s attach guard (an admin
 * action, never in the same request as the sign-in), and invite accept/decline
 * read the session's own amr claims, not the marker. A failed write just
 * means the marker is absent, which fails closed (attach refused).
 *
 * The marker is written only when an email change cannot have redirected the
 * link (`emailChangeQuiet`): a code's sign-in timestamp is the exchange time,
 * not the send time, so instead of ordering against send timestamps we require
 * that no change was requested in the 24 h (plus exchange grace) before the
 * sign-in and the email identity was neither updated after it nor changed
 * inside that window.
 * `at` is the link method's own amr timestamp, not the wall clock.
 */
export function recordEmailLinkSignIn(supabase: unknown): void {
  try {
    after(() => writeEmailLinkMarker(supabase));
  } catch (e) {
    // `after` unavailable outside a request scope: skip rather than delay or
    // fail the sign-in redirect.
    console.warn("[email-link-signin] schedule failed:", safeErrorFields(e));
  }
}

async function writeEmailLinkMarker(supabase: unknown): Promise<void> {
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
      console.warn("[email-link-signin] marker skipped: email-change quiet check failed");
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
 * marker's email equals the current email (case-insensitive) and
 * `emailChangeQuiet` holds against the marker's time (no change requested in
 * the window before it, identity not updated after it, and any identity change
 * older than the window; a password change cannot clear the identity signal).
 */
export function hasCurrentEmailLinkSignIn(user: MarkerUser): boolean {
  const raw = user.app_metadata?.email_link_signin;
  if (!raw || typeof raw !== "object") return false;
  const { at, email } = raw as Partial<EmailLinkMarker>;
  if (typeof email !== "string" || typeof user.email !== "string") return false;
  if (email.toLowerCase() !== user.email.toLowerCase()) return false;
  const markerAt = toSeconds(at);
  if (markerAt === null) return false;
  return emailChangeQuiet({
    emailChangeSentAt: user.email_change_sent_at,
    identities: user.identities,
    linkTs: markerAt,
  });
}
