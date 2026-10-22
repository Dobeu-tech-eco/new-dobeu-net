import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";
import { createAdminClient } from "@/lib/supabase/server";
import { runCleanup } from "@/lib/cron/cleanup";
import { GET, runtime, dynamic } from "./route";

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/cron/cleanup", () => ({ runCleanup: vi.fn() }));

const summary = {
  pageEvents: 3,
  projectFiles: 2,
  workOrderAttachments: 1,
  failedTargets: [],
};
const request = (token?: string) =>
  new Request("https://example.com/api/cron/cleanup", {
    headers: token ? { Authorization: token } : {},
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  const { supabase } = buildStubClient({});
  vi.mocked(createAdminClient).mockReturnValue(
    supabase as unknown as ReturnType<typeof createAdminClient>,
  );
  vi.mocked(runCleanup).mockResolvedValue(summary);
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/cleanup", () => {
  it.each(["no secret", "no header", "wrong token"])(
    "returns 401: %s, before creating a service-role client",
    async (scenario) => {
      if (scenario === "no secret") vi.stubEnv("CRON_SECRET", undefined);
      const res = await GET(
        request(
          scenario === "no header"
            ? undefined
            : scenario === "wrong token"
              ? "Bearer wrong"
              : "Bearer test-secret",
        ),
      );
      expect(res.status).toBe(401);
      expect(createAdminClient).not.toHaveBeenCalled();
      expect(runCleanup).not.toHaveBeenCalled();
    },
  );

  it("returns the count summary for an authorized request on the Node dynamic route", async () => {
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(summary);
    expect(createAdminClient).toHaveBeenCalledTimes(1);
    expect(runCleanup).toHaveBeenCalledExactlyOnceWith(
      vi.mocked(createAdminClient).mock.results[0].value,
    );
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns the not-configured path without exposing configuration details", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("missing service role");
    });
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(runCleanup).not.toHaveBeenCalled();
  });

  it("returns partial cleanup results when an individual target fails", async () => {
    const partial = {
      ...summary,
      pageEvents: 0,
      failedTargets: ["page_events"],
    };
    vi.mocked(runCleanup).mockResolvedValue(partial);
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(partial);
  });
});
