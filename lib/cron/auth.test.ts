import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCronRequest } from "./auth";

afterEach(() => vi.unstubAllEnvs());

describe("verifyCronRequest", () => {
  it("fails closed without a secret, including a literal undefined token", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    expect(
      verifyCronRequest(
        new Request("https://example.com", {
          headers: { Authorization: "Bearer undefined" },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a missing header", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect(verifyCronRequest(new Request("https://example.com"))).toBe(false);
  });

  it.each([
    "Bearer wrong",
    "Bearer test-secrex",
    "Basic test-secret",
    "Bearer longer-test-secret",
    "Bearer 🔐🔐🔐",
  ])("rejects an invalid token without throwing: %s", (authorization) => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    // Construct a header-like request to exercise UTF-8 byte length too.
    const req = { headers: { get: () => authorization } } as unknown as Request;
    expect(verifyCronRequest(req)).toBe(false);
  });

  it("accepts the exact bearer token", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect(
      verifyCronRequest(
        new Request("https://example.com", {
          headers: { authorization: "Bearer test-secret" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects an empty configured secret", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(
      verifyCronRequest(
        new Request("https://example.com", {
          headers: { Authorization: "Bearer" },
        }),
      ),
    ).toBe(false);
  });
});
