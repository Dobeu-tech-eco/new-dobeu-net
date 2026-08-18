import { describe, expect, it } from "vitest";
import { toServicePath } from "./path.mjs";

describe("toServicePath", () => {
  it("strips the public /oci prefix used by vercel.json rewrites", () => {
    expect(toServicePath("/oci")).toBe("/");
    expect(toServicePath("/oci/")).toBe("/");
    expect(toServicePath("/oci/health")).toBe("/health");
    expect(toServicePath("/oci/healthz")).toBe("/healthz");
    expect(toServicePath("/oci/nested/path")).toBe("/nested/path");
  });

  it("leaves already-stripped and unrelated paths alone", () => {
    expect(toServicePath("/")).toBe("/");
    expect(toServicePath("/health")).toBe("/health");
    expect(toServicePath("/api/lead")).toBe("/api/lead");
  });
});
