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
    text: "Member added. We've emailed them to sign in at /login with this email address using the emailed sign-in link (not a password), then accept the invite on their portal."
  },
  invite_email_failed: {
    tone: "warning",
    role: "alert",
    text: "Member added, but the invite email didn't send. Ask them to sign in at /login with their email address using the emailed sign-in link (not a password), then accept the invite on their portal."
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
  invitee_needs_link_signin: {
    tone: "error",
    role: "alert",
    text: "This address already has an account that has never signed in with an emailed sign-in link. Ask them to sign in once at the login page using the emailed link, then invite them again."
  },
  daily_limit: {
    tone: "warning",
    role: "status",
    text: "This company has reached its invite limit for the last 24 hours. Try again later."
  },
  rate_limited: {
    tone: "warning",
    role: "status",
    text: "Too many invites in a minute. Wait a moment, then try again."
  }
} as const satisfies Record<string, MemberNotice>;

export function memberNoticeMessage(code: unknown): MemberNotice | null {
  if (typeof code !== "string" || !Object.hasOwn(MEMBER_NOTICES, code)) return null;
  const { tone, role, text } = MEMBER_NOTICES[code as keyof typeof MEMBER_NOTICES];
  return { tone, role, text };
}
