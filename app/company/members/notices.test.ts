import { describe, expect, it } from "vitest";
import { memberNoticeMessage } from "./notices";

describe("memberNoticeMessage", () => {
  it.each([
    ["member_added", "success", "status", "Member added. We've emailed them to sign in at /login with this email address using the emailed sign-in link (not a password), then accept the invite on their portal."],
    ["invite_email_failed", "warning", "alert", "Member added, but the invite email didn't send. Ask them to sign in at /login with their email address using the emailed sign-in link (not a password), then accept the invite on their portal."],
    ["already_member", "warning", "status", "That person is already a member of this company."],
    ["invite_failed", "error", "alert", "Couldn't add that member. Check the email address and role, then try again."],
    ["invitee_needs_link_signin", "error", "alert", "This address already has an account whose current email has not been confirmed by an emailed sign-in link since it last changed. Ask them to sign in once at the login page using the emailed link, then invite them again."],
    ["daily_limit", "warning", "status", "This company has reached its invite limit for the last 24 hours. Try again later."],
    ["role_changed", "success", "status", "Member role updated."],
    ["role_change_failed", "error", "alert", "Couldn't change that member's role. Try again."],
    ["member_deactivated", "success", "status", "Member deactivated."],
    ["deactivate_failed", "error", "alert", "Couldn't deactivate that member. Try again."],
    ["cannot_disable_self", "error", "alert", "You can't deactivate your own membership."],
    ["not_found", "error", "alert", "That member could not be found. Refresh the page and try again."],
    ["unknown_role", "error", "alert", "That role isn't available. Choose a listed role and try again."],
    ["rate_limited", "warning", "status", "Too many invites in a minute. Wait a moment, then try again."]
  ] as const)("maps %s to exact tone, role and copy", (code, tone, role, text) => {
    expect(memberNoticeMessage(code)).toEqual({ tone, role, text });
  });

  it.each(["mfa_required", "forbidden"])("no longer has a notice for %s", (code) => {
    expect(memberNoticeMessage(code)).toBeNull();
  });

  it.each([undefined, null, "", "nope", "__proto__", "toString", ["member_added"], 5, {}])(
    "returns null for %j",
    (v) => {
      expect(memberNoticeMessage(v)).toBeNull();
    }
  );
});
