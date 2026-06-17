import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

describe("intercomUserHash", () => {
  const ORIGINAL = process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET;
  afterEach(() => {
    process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET = ORIGINAL;
    viResetModules();
  });
  beforeEach(() => {
    viResetModules();
  });

  function viResetModules() {
    // re-import fresh so the module reads the current env at call time
  }

  it("returns the HMAC-SHA256 hex digest of the user_id keyed by the secret", async () => {
    process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET = "test_secret_123";
    const { intercomUserHash } = await import("@/lib/intercom-hmac");
    const userId = "00000000-0000-0000-0000-000000000001";
    const expected = createHmac("sha256", "test_secret_123").update(userId).digest("hex");
    expect(intercomUserHash(userId)).toBe(expected);
  });

  it("returns undefined when the secret is unset (graceful no-op)", async () => {
    delete process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET;
    const { intercomUserHash } = await import("@/lib/intercom-hmac");
    expect(intercomUserHash("any-id")).toBeUndefined();
  });
});
