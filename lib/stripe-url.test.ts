import { describe, expect, it } from "vitest";
import { safeStripeInvoiceUrl } from "@/lib/stripe-url";

describe("safeStripeInvoiceUrl", () => {
  it("accepts https invoice.stripe.com", () => {
    expect(safeStripeInvoiceUrl("https://invoice.stripe.com/i/x")).toBe("https://invoice.stripe.com/i/x");
  });
  it.each([
    "javascript:alert(1)",
    "http://invoice.stripe.com/i/x",
    "https://evil.example/i/x",
    "https://invoice.stripe.com.evil.example/x",
    "not a url",
    "",
    null,
    undefined,
  ])("rejects %s", (v) => {
    expect(safeStripeInvoiceUrl(v as string | null | undefined)).toBeNull();
  });
});
