import { describe, expect, it } from "vitest";
import { memberNoticeMessage } from "./notices";

describe("memberNoticeMessage", () => {
  it.each([
    ["member_added", "success"],
    ["invite_email_failed", "warning"],
    ["invite_failed", "error"],
    ["rate_limited", "warning"]
  ])("maps %s to a %s message", (code, tone) => {
    const n = memberNoticeMessage(code);
    expect(n?.tone).toBe(tone);
    expect(n?.text.length).toBeGreaterThan(0);
  });

  it.each([undefined, null, "", "nope", "__proto__", "toString", ["member_added"], 5, {}])(
    "returns null for %j",
    (v) => {
      expect(memberNoticeMessage(v)).toBeNull();
    }
  );
});
