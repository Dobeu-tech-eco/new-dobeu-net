import { describe, it, expect } from "vitest";
import { tooLargeMessage, MAX_DELIVERABLE_BYTES, ALLOWED_DELIVERABLE_MIME } from "@/lib/deliverable-limits";

describe("deliverable-limits", () => {
  it("formats the over-cap message with one decimal", () => {
    expect(tooLargeMessage(26 * 1024 * 1024)).toBe(
      "File too large: 26.0 MB. Deliverables are capped at 25 MB."
    );
    expect(tooLargeMessage(27262976)).toBe("File too large: 26.0 MB. Deliverables are capped at 25 MB.");
  });

  it("caps at 26214400 bytes and excludes svg", () => {
    expect(MAX_DELIVERABLE_BYTES).toBe(26214400);
    expect((ALLOWED_DELIVERABLE_MIME as readonly string[]).includes("image/svg+xml")).toBe(false);
  });
});
