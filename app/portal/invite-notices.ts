import type { InviteResponseNoticeCode } from "@/lib/actions/invites";

// Only these fixed messages may be displayed for a `notice` URL code on /portal.
// The input is never echoed: unknown, array and non-string values resolve to null.
export type InviteNoticeTone = "success" | "warning" | "error";
export type InviteNoticeRole = "status" | "alert";

export interface InviteNotice {
  tone: InviteNoticeTone;
  role: InviteNoticeRole;
  text: string;
}

const INVITE_NOTICES = {
  invite_accepted: {
    tone: "success",
    role: "status",
    text: "You've joined the company.",
  },
  invite_declined: {
    tone: "success",
    role: "status",
    text: "Invite declined and removed.",
  },
  invite_accepted_company_inactive: {
    tone: "warning",
    role: "status",
    text: "You're now a member, but this company is suspended right now, so its pages are unavailable until it is active again.",
  },
  invite_unavailable: {
    tone: "warning",
    role: "status",
    text: "This invite is no longer available. It may have been withdrawn or already answered. Ask a company admin if you still need access.",
  },
  invite_company_inactive: {
    tone: "warning",
    role: "status",
    text: "This company is suspended right now, so the invite can't be accepted yet. It is still pending: you can accept it once the company is active again, or decline it.",
  },
  invite_already_accepted: {
    tone: "success",
    role: "status",
    text: "You already accepted this invite.",
  },
  invite_signin_stale: {
    tone: "warning",
    role: "alert",
    text: "To answer this invite, sign out and sign in again with the emailed sign-in link. Your current sign-in started before the invite was sent.",
  },
  invite_email_changed: {
    tone: "warning",
    role: "alert",
    text: "Your account email changed after you signed in. Sign out and sign in again with the emailed sign-in link to answer this invite.",
  },
  invite_email_unconfirmed: {
    tone: "warning",
    role: "alert",
    text: "To answer this invite, sign out and sign in again using the email link option on the login page, with the link sent to your email address. Then accept or decline here.",
  },
  invite_response_failed: {
    tone: "error",
    role: "alert",
    text: "Couldn't save your answer. Try again.",
  },
} as const satisfies Record<InviteResponseNoticeCode, InviteNotice>;

export function inviteNoticeMessage(code: unknown): InviteNotice | null {
  if (typeof code !== "string" || !Object.hasOwn(INVITE_NOTICES, code)) return null;
  const { tone, role, text } = INVITE_NOTICES[code as InviteResponseNoticeCode];
  return { tone, role, text };
}

export const INVITE_NOTICE_STYLES: Record<InviteNoticeTone, string> = {
  success: "border-primary/30 bg-primary/10 text-foreground",
  warning: "border-accent/40 bg-accent/10 text-foreground",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
};
