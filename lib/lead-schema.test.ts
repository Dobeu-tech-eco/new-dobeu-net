import { describe, it, expect } from "vitest";
import { LeadSchema } from "@/lib/lead-schema";

describe("LeadSchema", () => {
  it("accepts a minimal payload with just email", () => {
    const result = LeadSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
      expect(result.data.source).toBe("other");
      expect(result.data.utm).toEqual({});
    }
  });

  it("accepts a full payload with all fields", () => {
    const result = LeadSchema.safeParse({
      email: "lead@company.com",
      name: "Jane Doe",
      company: "Acme Corp",
      message: "I need help building an AI agent.",
      source: "email",
      utm: { utm_source: "google", utm_medium: "cpc" },
      referrer: "https://google.com"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Jane Doe");
      expect(result.data.source).toBe("email");
      expect(result.data.utm).toEqual({ utm_source: "google", utm_medium: "cpc" });
    }
  });

  it("rejects an invalid email", () => {
    const result = LeadSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = LeadSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a message exceeding 2000 characters", () => {
    const result = LeadSchema.safeParse({
      email: "a@b.com",
      message: "x".repeat(2001)
    });
    expect(result.success).toBe(false);
  });

  it("accepts a message exactly at 2000 characters", () => {
    const result = LeadSchema.safeParse({
      email: "a@b.com",
      message: "x".repeat(2000)
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid source", () => {
    const result = LeadSchema.safeParse({ email: "a@b.com", source: "invalid" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid source values", () => {
    for (const source of ["book", "form", "email", "typeform", "other"]) {
      const result = LeadSchema.safeParse({ email: "a@b.com", source });
      expect(result.success).toBe(true);
    }
  });

  it("treats null name/company/message as valid", () => {
    const result = LeadSchema.safeParse({
      email: "a@b.com",
      name: null,
      company: null,
      message: null
    });
    expect(result.success).toBe(true);
  });
});
