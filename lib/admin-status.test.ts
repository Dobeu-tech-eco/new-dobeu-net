import { describe, expect, it } from "vitest";
import { ADMIN_ERROR_MESSAGES, adminErrorMessage } from "./admin-status";

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
