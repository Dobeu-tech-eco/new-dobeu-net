import { describe, expect, it } from "vitest";
import { COMPANY_PATH_HEADER, companyDeepLink } from "@/lib/company-path";

describe("companyDeepLink", () => {
  it("exports the header name", () => {
    expect(COMPANY_PATH_HEADER).toBe("x-dobeu-pathname");
  });

  it.each([
    "/company/../admin",
    "/company/%2e%2e/admin",
    "/company/%2E%2e/admin",
    "/company/foo/../../portal",
    "/company/./members",
    "/company/%2e/members",
    "/company/..%2fadmin",
    "/company/%252e%252e/admin",
    "/company/..?x=1",
    "//evil.com",
    "https://x.example",
    "/portal",
    "/companyfoo",
    "/company/\u0001x",
    "/company\tx",
    "/company\\x",
    "",
    null,
    undefined
  ])("falls back for %j", (value) => {
    expect(companyDeepLink(value)).toBe("/company");
    expect(companyDeepLink(value, "/company/members?company=c1")).toBe("/company/members?company=c1");
  });

  it.each(["/company", "/company/members?company=x&tab=y", "/company?company=x", "/company/members"])(
    "preserves %s",
    (value) => {
      expect(companyDeepLink(value, "/fallback")).toBe(value);
    }
  );

  it("drops the hash", () => {
    expect(companyDeepLink("/company/members?a=1#frag")).toBe("/company/members?a=1");
  });
});
