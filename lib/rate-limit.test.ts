import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, hashIp } from "./rate-limit";

describe("hashIp", () => {
  it("produces a deterministic ip_ prefixed token", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp("1.2.3.4"));
    expect(hashIp("1.2.3.4")).toMatch(/^ip_/);
  });

  it("differs for distinct IPs", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("5.6.7.8"));
  });
});

describe("checkRateLimit (memory backend)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("allows up to max requests then blocks", async () => {
    const key = `mem:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(key, { windowSec: 60, max: 3 });
      expect(r.limited).toBe(false);
      expect(r.backend).toBe("memory");
    }
    const blocked = await checkRateLimit(key, { windowSec: 60, max: 3 });
    expect(blocked.limited).toBe(true);
    expect(blocked.backend).toBe("memory");
  });
});

describe("checkRateLimit (Upstash backend)", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("uses the upstash pipeline INCR result", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify([{ result: 2 }, { result: 1 }]), { status: 200 })
    ) as typeof fetch;

    const r = await checkRateLimit("k", { windowSec: 60, max: 5 });
    expect(r.backend).toBe("upstash");
    expect(r.limited).toBe(false);
    expect(r.count).toBe(2);
  });

  it("falls back to memory on Upstash HTTP error", async () => {
    global.fetch = vi.fn(async () => new Response("boom", { status: 500 })) as typeof fetch;
    const r = await checkRateLimit(`k:${Math.random()}`, { windowSec: 60, max: 1 });
    expect(r.backend).toBe("memory");
  });
});
