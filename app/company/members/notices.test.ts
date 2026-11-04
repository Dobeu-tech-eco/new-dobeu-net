import { describe, expect, it } from "vitest";
import { memberNoticeMessage } from "./notices";

describe("memberNoticeMessage", () => {
  it.each([
    ["member_added", "success", "status", "Member added. We've emailed them to sign in at /login with this email address."],
    ["invite_email_failed", "warning", "alert", "Member added, but the invite email didn't send. Ask them to sign in at /login with their email address."],
    ["already_member", "warning", "status", "That person is already a member of this company."],
    ["invite_failed", "error", "alert", "Couldn't add that member. Check the email address and role, then try again."],
    ["daily_limit", "warning", "status", "This company has reached today's invite limit. Try again tomorrow."],
    ["rate_limited", "warning", "status", "Too many invites in a minute. Wait a moment, then try again."],
    ["mfa_required", "warning", "alert", "Confirm it's you with two-factor first (Portal → Settings → two-factor), then try again."],
    ["forbidden", "error", "alert", "You can't manage members for this company right now. Return to the portal or contact Dobeu."]
  ] as const)("maps %s to exact tone, role and copy", (code, tone, role, text) => {
    expect(memberNoticeMessage(code)).toEqual({ tone, role, text });
  });

  it.each([undefined, null, "", "nope", "__proto__", "toString", ["member_added"], 5, {}])(
    "returns null for %j",
    (v) => {
      expect(memberNoticeMessage(v)).toBeNull();
    }
  );
});
