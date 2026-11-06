import { describe, expect, it } from "vitest";
import { inviteNoticeMessage } from "./invite-notices";

describe("inviteNoticeMessage", () => {
  it.each([
    ["invite_accepted", "success", "status", "You've joined the company."],
    ["invite_declined", "success", "status", "Invite declined and removed."],
    ["invite_accepted_company_inactive", "warning", "status", "You're now a member, but this company is suspended right now, so its pages are unavailable until it is active again."],
    ["invite_unavailable", "warning", "status", "This invite is no longer available. It may have been withdrawn or already answered. Ask a company admin if you still need access."],
    ["invite_company_inactive", "warning", "status", "This company is suspended right now, so the invite can't be accepted yet. It is still pending: you can accept it once the company is active again, or decline it."],
    ["invite_already_accepted", "success", "status", "You already accepted this invite."],
    ["invite_signin_stale", "warning", "alert", "To answer this invite, sign out and sign in again with the emailed sign-in link. Your current sign-in started before the invite was sent."],
    ["invite_email_changed", "warning", "alert", "Your account email changed after this invite was sent, or within the last 24 hours, so this invite can't be accepted from this account. A change made after the invite blocks it until the invite is sent again: decline it here, then ask a company admin to send a new invite."],
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
