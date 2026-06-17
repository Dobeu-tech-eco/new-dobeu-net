import { describe, it, expect, afterEach } from "vitest";
import { isCustomerIoConfigured } from "@/lib/customerio";

describe("isCustomerIoConfigured", () => {
  const origSiteId = process.env.CUSTOMERIO_SITE_ID;
  const origApiKey = process.env.CUSTOMERIO_API_KEY;

  afterEach(() => {
    if (origSiteId) process.env.CUSTOMERIO_SITE_ID = origSiteId;
    else delete process.env.CUSTOMERIO_SITE_ID;
    if (origApiKey) process.env.CUSTOMERIO_API_KEY = origApiKey;
    else delete process.env.CUSTOMERIO_API_KEY;
  });

  it("returns false when neither env var is set", () => {
    delete process.env.CUSTOMERIO_SITE_ID;
    delete process.env.CUSTOMERIO_API_KEY;
    expect(isCustomerIoConfigured()).toBe(false);
  });

  it("returns false when only site ID is set", () => {
    process.env.CUSTOMERIO_SITE_ID = "test-site";
    delete process.env.CUSTOMERIO_API_KEY;
    expect(isCustomerIoConfigured()).toBe(false);
  });

  it("returns false when only API key is set", () => {
    delete process.env.CUSTOMERIO_SITE_ID;
    process.env.CUSTOMERIO_API_KEY = "test-key";
    expect(isCustomerIoConfigured()).toBe(false);
  });

  it("returns true when both env vars are set", () => {
    process.env.CUSTOMERIO_SITE_ID = "test-site";
    process.env.CUSTOMERIO_API_KEY = "test-key";
    expect(isCustomerIoConfigured()).toBe(true);
  });
});
