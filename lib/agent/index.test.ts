import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAgentConfigured, runAgent } from "./index";

describe("agent gating", () => {
  const originalComposio = process.env.COMPOSIO_API_KEY;
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.COMPOSIO_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalComposio !== undefined)
      process.env.COMPOSIO_API_KEY = originalComposio;
    else delete process.env.COMPOSIO_API_KEY;
    if (originalAnthropic !== undefined)
      process.env.ANTHROPIC_API_KEY = originalAnthropic;
    else delete process.env.ANTHROPIC_API_KEY;
  });

  it("isAgentConfigured returns false when either key is missing", () => {
    expect(isAgentConfigured()).toBe(false);
    process.env.COMPOSIO_API_KEY = "x";
    expect(isAgentConfigured()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "y";
    expect(isAgentConfigured()).toBe(true);
  });

  it("runAgent returns not_configured without throwing", async () => {
    const r = await runAgent({ userId: "u", prompt: "hi" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_configured");
  });

  it("runAgent returns sdk_not_installed when env is set but packages are missing", async () => {
    process.env.COMPOSIO_API_KEY = "x";
    process.env.ANTHROPIC_API_KEY = "y";
    const r = await runAgent({ userId: "u", prompt: "hi" });
    // In this test environment the SDKs are intentionally not installed yet,
    // so the dynamic import inside runAgent will fail and return this error.
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(["sdk_not_installed", "session_create_failed"]).toContain(r.error);
  });
});
