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
  invite_unavailable: {
    tone: "warning",
    role: "status",
    text: "That invite is no longer available. It may already be answered, withdrawn, or the company is inactive.",
  },
  invite_email_unconfirmed: {
    tone: "warning",
    role: "alert",
    text: "Confirm your email address first: sign in with the link we sent to it, then answer the invite here.",
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
