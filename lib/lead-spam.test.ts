import { describe, it, expect } from "vitest";
import { assessLead, buildAllowedOrigins, looksLikeGibberish } from "@/lib/lead-spam";

const allowed = new Set(["https://dobeu.net"]);
const base = { origin: "https://dobeu.net", allowedOrigins: allowed, elapsedMs: 10_000 };

describe("assessLead", () => {
  it("passes a normal submission", () => {
    expect(assessLead({ ...base, message: "Need a new website for my bakery" })).toEqual({ spam: false });
  });
  it("flags honeypot", () => {
    expect(assessLead({ ...base, honeypot: "http://x.co" }).reason).toBe("honeypot");
  });
  it("flags too-fast (<1500ms) and missing elapsed_ms", () => {
    expect(assessLead({ ...base, elapsedMs: 1499 }).reason).toBe("too_fast");
    expect(assessLead({ ...base, elapsedMs: 1500 }).spam).toBe(false);
    expect(assessLead({ ...base, elapsedMs: undefined }).reason).toBe("missing_signal");
  });
  it("flags missing or foreign origin", () => {
    expect(assessLead({ ...base, origin: null }).reason).toBe("origin");
    expect(assessLead({ ...base, origin: "https://evil.example" }).reason).toBe("origin");
  });
  it("catches the bot's real payload", () => {
    expect(assessLead({ ...base, message: "IwRRUNZxkePMWRwvjkC" }).reason).toBe("gibberish");
  });
  it.each(["Hi", "Pricing?", "WordPress", "https://example.com/Some/Path", "McDonaldsFranchiseInquiry", "Need a new website for my bakery"])(
    "does not flag real message %s",
    (m) => {
      expect(looksLikeGibberish(m)).toBe(false);
    }
  );
});

describe("buildAllowedOrigins", () => {
  it("includes site, vercel preview, and localhost only outside production", () => {
    const dev = buildAllowedOrigins({
      NODE_ENV: "development",
      VERCEL_BRANCH_URL: "b.vercel.app",
      NEXT_PUBLIC_SITE_URL: "https://staging.dobeu.net/x",
      VERCEL_URL: "p.vercel.app"
    } as NodeJS.ProcessEnv);
    expect(dev.has("https://staging.dobeu.net")).toBe(true);
    expect(dev.has("https://p.vercel.app")).toBe(true);
    expect(dev.has("https://b.vercel.app")).toBe(true);
    expect(dev.has("http://localhost:3000")).toBe(true);
    const prod = buildAllowedOrigins({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(prod.has("http://localhost:3000")).toBe(false);
    expect(prod.has("https://www.dobeu.net")).toBe(true);
  });
});
