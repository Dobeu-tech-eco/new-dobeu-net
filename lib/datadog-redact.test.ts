import { describe, expect, it } from "vitest";
import { redactUrl } from "@/lib/datadog-redact";

describe("redactUrl token_hash", () => {
  it("redacts token_hash", () => {
    expect(redactUrl("/auth/callback?token_hash=secret&type=invite")).not.toContain("secret");
  });
});
