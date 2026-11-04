import { describe, expect, it } from "vitest";
import { inviteNoticeMessage } from "./invite-notices";

describe("inviteNoticeMessage", () => {
  it.each([
    ["invite_accepted", "success", "status", "You've joined the company."],
    ["invite_declined", "success", "status", "Invite declined and removed."],
    ["invite_unavailable", "warning", "status", "That invite is no longer available. It may already be answered, withdrawn, or the company is inactive. Ask a company admin to send a new invite."],
    ["invite_email_unconfirmed", "warning", "alert", "To answer this invite, sign out and sign in again using the email link option on the login page, with the link sent to your email address. Then accept or decline here."],
    ["invite_response_failed", "error", "alert", "Couldn't save your answer. Try again."],
  ] as const)("maps %s to exact tone, role and copy", (code, tone, role, text) => {
    expect(inviteNoticeMessage(code)).toEqual({ tone, role, text });
  });

  it.each(["mfa_required", "forbidden", "member_added"])("has no notice for %s", (code) => {
    expect(inviteNoticeMessage(code)).toBeNull();
  });

  it.each([undefined, null, "", "nope", "__proto__", "toString", ["invite_accepted"], 5, {}])(
    "returns null for %j",
    (v) => {
      expect(inviteNoticeMessage(v)).toBeNull();
    },
  );
});
