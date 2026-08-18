import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, type GitHubEvent } from "@/app/api/github-activity/route";

const fetchMock = vi.fn();

function ghEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    type: "PushEvent",
    repo: { name: "Dobeu-tech-eco/some-repo" },
    payload: { commits: [{ message: "feat: something" }] },
    created_at: "2026-07-25T12:00:00Z",
    ...overrides
  };
}

function okResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // Deterministic: no token unless a test opts in.
  vi.stubEnv("GITHUB_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/github-activity", () => {
  it("returns fallback events when GitHub responds non-OK", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    const res = await GET();
    const events = (await res.json()) as GitHubEvent[];

    expect(events).toHaveLength(3);
    expect(events.every((e) => e.id.startsWith("fallback-"))).toBe(true);
  });

  it("returns fallback events when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const res = await GET();
    const events = (await res.json()) as GitHubEvent[];

    expect(events.every((e) => e.id.startsWith("fallback-"))).toBe(true);
  });

  it("returns fallback events when nothing parseable comes back", async () => {
    fetchMock.mockResolvedValue(
      okResponse([ghEvent({ type: "WatchEvent", payload: {} }), ghEvent({ type: "ForkEvent", payload: {} })])
    );

    const res = await GET();
    const events = (await res.json()) as GitHubEvent[];

    expect(events.every((e) => e.id.startsWith("fallback-"))).toBe(true);
  });

  it("parses push, PR, and release events and strips the org prefix", async () => {
    fetchMock.mockResolvedValue(
      okResponse([
        ghEvent({ id: "10" }),
        ghEvent({
          id: "11",
          type: "PullRequestEvent",
          payload: { pull_request: { title: "Add feature", html_url: "https://github.com/pr/1" } }
        }),
        ghEvent({
          id: "12",
          type: "ReleaseEvent",
          payload: { release: { name: "v1.0.0", html_url: "https://github.com/rel/1" } }
        })
      ])
    );

    const res = await GET();
    const events = (await res.json()) as GitHubEvent[];

    expect(events).toEqual([
      expect.objectContaining({ id: "10", type: "push", repo: "some-repo", message: "feat: something" }),
      expect.objectContaining({ id: "11", type: "pr", message: "Add feature", url: "https://github.com/pr/1" }),
      expect.objectContaining({ id: "12", type: "release", message: "Released v1.0.0" })
    ]);
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("keeps only the first commit line, truncates to 72 chars, and caps at 6 events", async () => {
    const longMessage = "x".repeat(100) + "\nsecond line ignored";
    const items = Array.from({ length: 10 }, (_, i) =>
      ghEvent({ id: String(i), payload: { commits: [{ message: longMessage }] } })
    );
    fetchMock.mockResolvedValue(okResponse(items));

    const res = await GET();
    const events = (await res.json()) as GitHubEvent[];

    expect(events).toHaveLength(6);
    expect(events[0].message).toBe("x".repeat(72));
    expect(events[0].message).not.toContain("second line");
  });

  it("skips push events with no commits instead of failing", async () => {
    fetchMock.mockResolvedValue(
      okResponse([ghEvent({ id: "20", payload: { commits: [] } }), ghEvent({ id: "21" })])
    );

    const res = await GET();
    const events = (await res.json()) as GitHubEvent[];

    expect(events.map((e) => e.id)).toEqual(["21"]);
  });

  it("sends an Authorization header only when GITHUB_TOKEN is set", async () => {
    fetchMock.mockResolvedValue(okResponse([ghEvent()]));

    await GET();
    let headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();

    vi.stubEnv("GITHUB_TOKEN", "gh-test-token");
    await GET();
    headers = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer gh-test-token");
  });
});
