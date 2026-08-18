import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/cron", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("rejects when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new Request("https://example.com/api/cron"));
    expect(res.status).toBe(401);
    await expect(res.text()).resolves.toBe("Unauthorized");
  });

  it("rejects missing Authorization header", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await GET(new Request("https://example.com/api/cron"));
    expect(res.status).toBe(401);
    await expect(res.text()).resolves.toBe("Unauthorized");
  });

  it("rejects wrong bearer token", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await GET(
      new Request("https://example.com/api/cron", {
        headers: { Authorization: "Bearer wrong" },
      }),
    );
    expect(res.status).toBe(401);
    await expect(res.text()).resolves.toBe("Unauthorized");
  });

  it("accepts valid bearer when CRON_SECRET is set", async () => {
    process.env.CRON_SECRET = "test-secret";
    const res = await GET(
      new Request("https://example.com/api/cron", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
