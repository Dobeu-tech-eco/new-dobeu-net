import { describe, it, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";

describe("createIntercomUserJwt", () => {
  const ORIGINAL = process.env.INTERCOM_API_SECRET;
  const SECRET = "test_intercom_api_secret_for_jwt";

  beforeEach(() => {
    process.env.INTERCOM_API_SECRET = SECRET;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.INTERCOM_API_SECRET;
    else process.env.INTERCOM_API_SECRET = ORIGINAL;
  });

  it("returns undefined when secret is unset", async () => {
    delete process.env.INTERCOM_API_SECRET;
    const { createIntercomUserJwt } = await import("@/lib/intercom-jwt");
    expect(createIntercomUserJwt({ user_id: "visitor-1" })).toBeUndefined();
  });

  it("signs a JWT with required user_id", async () => {
    const { createIntercomUserJwt } = await import("@/lib/intercom-jwt");
    const token = createIntercomUserJwt({ user_id: "visitor-1" });
    expect(token).toBeTruthy();
    const decoded = jwt.verify(token!, SECRET) as jwt.JwtPayload;
    expect(decoded.user_id).toBe("visitor-1");
    expect(decoded.exp).toBeTruthy();
  });

  it("includes optional sensitive attributes in the payload", async () => {
    const { createIntercomUserJwt } = await import("@/lib/intercom-jwt");
    const token = createIntercomUserJwt({
      user_id: "u1",
      email: "a@b.com",
      name: "Tester",
      created_at: 1704067200
    });
    const decoded = jwt.verify(token!, SECRET) as jwt.JwtPayload;
    expect(decoded).toMatchObject({
      user_id: "u1",
      email: "a@b.com",
      name: "Tester",
      created_at: 1704067200
    });
  });
});

describe("isIntercomSecureMessengerEnabled", () => {
  const ORIGINAL = process.env.INTERCOM_API_SECRET;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.INTERCOM_API_SECRET;
    else process.env.INTERCOM_API_SECRET = ORIGINAL;
  });

  it("returns true when INTERCOM_API_SECRET is set", async () => {
    process.env.INTERCOM_API_SECRET = "x";
    const { isIntercomSecureMessengerEnabled } = await import("@/lib/intercom-jwt");
    expect(isIntercomSecureMessengerEnabled()).toBe(true);
  });

  it("returns false when secret is unset", async () => {
    delete process.env.INTERCOM_API_SECRET;
    const { isIntercomSecureMessengerEnabled } = await import("@/lib/intercom-jwt");
    expect(isIntercomSecureMessengerEnabled()).toBe(false);
  });
});
