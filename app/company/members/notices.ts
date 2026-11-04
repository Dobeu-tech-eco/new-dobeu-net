// Only these fixed messages may be displayed for a `notice` URL code. The input
// is never echoed: unknown, array and non-string values resolve to null.
export type MemberNoticeTone = "success" | "warning" | "error";

const MEMBER_NOTICES = {
  member_added: {
    tone: "success",
    text: "Member added. We've emailed them a link to sign in."
  },
  invite_email_failed: {
    tone: "warning",
    text: "Member added, but the invite email didn't send. Ask them to request a sign-in link at /login with their email address."
  },
  invite_failed: {
    tone: "error",
    text: "Couldn't add that member. Check the email and role and try again."
  },
  rate_limited: {
    tone: "warning",
    text: "Too many invites in a minute. Wait a moment and try again."
  }
} as const satisfies Record<string, { tone: MemberNoticeTone; text: string }>;

export function memberNoticeMessage(
  code: unknown
): { tone: MemberNoticeTone; text: string } | null {
  if (typeof code !== "string" || !Object.hasOwn(MEMBER_NOTICES, code)) return null;
  const { tone, text } = MEMBER_NOTICES[code as keyof typeof MEMBER_NOTICES];
  return { tone, text };
}
