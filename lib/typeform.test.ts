import { afterEach, describe, expect, it } from "vitest";
import {
  isTypeformWebhookConfigured,
  verifyTypeformSignature,
} from "./typeform";
import { createHmac } from "node:crypto";

describe("Typeform Webhook Config", () => {
  describe("isTypeformWebhookConfigured", () => {
    const originalSecret = process.env.TYPEFORM_WEBHOOK_SECRET;

    afterEach(() => {
      if (originalSecret === undefined) {
        delete process.env.TYPEFORM_WEBHOOK_SECRET;
      } else {
        process.env.TYPEFORM_WEBHOOK_SECRET = originalSecret;
      }
    });

    it("returns true when TYPEFORM_WEBHOOK_SECRET is set", () => {
      process.env.TYPEFORM_WEBHOOK_SECRET = "some_secret";
      expect(isTypeformWebhookConfigured()).toBe(true);
    });

    it("returns false when TYPEFORM_WEBHOOK_SECRET is not set", () => {
      delete process.env.TYPEFORM_WEBHOOK_SECRET;
      expect(isTypeformWebhookConfigured()).toBe(false);
    });

    it("returns false when TYPEFORM_WEBHOOK_SECRET is empty string", () => {
      process.env.TYPEFORM_WEBHOOK_SECRET = "";
      expect(isTypeformWebhookConfigured()).toBe(false);
    });
  });

  describe("verifyTypeformSignature", () => {
    const secret = "test_secret";
    const rawBody = JSON.stringify({ foo: "bar" });
    const validSignature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("base64")}`;

    it("returns true for a valid signature", () => {
      expect(verifyTypeformSignature(rawBody, validSignature, secret)).toBe(
        true,
      );
    });

    it("returns false if header is null", () => {
      expect(verifyTypeformSignature(rawBody, null, secret)).toBe(false);
    });

    it("returns false for an invalid signature (different base64)", () => {
      const invalidSignature = `sha256=${createHmac("sha256", secret)
        .update(rawBody + "tamper")
        .digest("base64")}`;
      expect(verifyTypeformSignature(rawBody, invalidSignature, secret)).toBe(
        false,
      );
    });

    it("returns false for an invalid signature (completely wrong format)", () => {
      expect(verifyTypeformSignature(rawBody, "invalid", secret)).toBe(false);
    });

    it("returns false if secret is wrong", () => {
      expect(
        verifyTypeformSignature(rawBody, validSignature, "wrong_secret"),
      ).toBe(false);
    });

    it("handles whitespace in the header correctly", () => {
      expect(
        verifyTypeformSignature(rawBody, `  ${validSignature}  `, secret),
      ).toBe(true);
    });
  });
});
