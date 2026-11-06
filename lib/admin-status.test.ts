import { describe, expect, it } from "vitest";
import {
  ADMIN_ERROR_MESSAGES,
  adminErrorMessage,
  provisionErrorCode,
} from "./admin-status";

describe("adminErrorMessage", () => {
  it.each([
    ["overview_load_failed", "Unable to load some overview data. Try again."],
    ["activity_partial", "Some recent activity could not be loaded."],
    ["totals_truncated", "Totals truncated; too many rows to sum here."],
  ])("maps %s to its fixed message", (code, message) => {
    expect(adminErrorMessage(code)).toBe(message);
  });

  it("falls back to the generic message for unknown or inherited codes", () => {
    expect(adminErrorMessage("nope")).toBe(ADMIN_ERROR_MESSAGES.unknown);
    expect(adminErrorMessage("toString")).toBe(ADMIN_ERROR_MESSAGES.unknown);
  });
});

describe("provisionErrorCode", () => {
  it.each([
    ["invitee_needs_link_signin", "admin_invitee_needs_link_signin"],
    ["already_member", "admin_already_member"],
    ["member_disabled", "admin_member_disabled"],
    ["invite failed", "admin_provision_failed"],
    ["Suspended & inactive?", "admin_provision_failed"],
  ])("maps %s to %s", (error, code) => {
    expect(provisionErrorCode(error)).toBe(code);
    expect(adminErrorMessage(code)).not.toBe(ADMIN_ERROR_MESSAGES.unknown);
  });
});
