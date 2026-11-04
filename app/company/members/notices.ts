// Only these fixed messages may be displayed for a `notice` URL code. The input
// is never echoed: unknown, array and non-string values resolve to null.
export type MemberNoticeTone = "success" | "warning" | "error";
export type MemberNoticeRole = "status" | "alert";

export interface MemberNotice {
  tone: MemberNoticeTone;
  role: MemberNoticeRole;
  text: string;
}

const MEMBER_NOTICES = {
  member_added: {
    tone: "success",
    role: "status",
    text: "Member added. We've emailed them to sign in at /login with this email address."
  },
  invite_email_failed: {
    tone: "warning",
    role: "alert",
    text: "Member added, but the invite email didn't send. Ask them to sign in at /login with their email address."
  },
  already_member: {
    tone: "warning",
    role: "status",
    text: "That person is already a member of this company."
  },
  invite_failed: {
    tone: "error",
    role: "alert",
    text: "Couldn't add that member. Check the email address and role, then try again."
  },
  daily_limit: {
    tone: "warning",
    role: "status",
    text: "This company has reached today's invite limit. Try again tomorrow."
  },
  rate_limited: {
    tone: "warning",
    role: "status",
    text: "Too many invites in a minute. Wait a moment, then try again."
  },
  mfa_required: {
    tone: "warning",
    role: "alert",
    text: "Confirm it's you with two-factor first (Portal → Settings → two-factor), then try again."
  },
  forbidden: {
    tone: "error",
    role: "alert",
    text: "You can't manage members for this company right now. Return to the portal or contact Dobeu."
  }
} as const satisfies Record<string, MemberNotice>;

export function memberNoticeMessage(code: unknown): MemberNotice | null {
  if (typeof code !== "string" || !Object.hasOwn(MEMBER_NOTICES, code)) return null;
  const { tone, role, text } = MEMBER_NOTICES[code as keyof typeof MEMBER_NOTICES];
  return { tone, role, text };
}
