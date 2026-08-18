import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/github-repo/route";

function makeRequest(q: string, ip = "1.2.3.4"): NextRequest {
  const url = new URL("http://localhost/api/github-repo");
  if (q !== undefined) url.searchParams.set("q", q);
  return new NextRequest(url, {
    headers: { "x-real-ip": ip }
  });
}

function mockGitHubFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/languages")) {
      return new Response(JSON.stringify({ JavaScript: 1234, TypeScript: 5678 }), {
        status: 200
      });
    }
    return new Response(
      JSON.stringify({
        id: 1,
        full_name: "vercel/next.js",
        name: "next.js",
        owner: { login: "vercel", avatar_url: "https://x/y.png", html_url: "https://github.com/vercel" },
        description: "The React Framework",
        html_url: "https://github.com/vercel/next.js",
        homepage: "https://nextjs.org",
        topics: ["react", "framework"],
        language: "JavaScript",
        stargazers_count: 100000,
        forks_count: 20000,
        open_issues_count: 1000,
        watchers_count: 100000,
        size: 12345,
        default_branch: "canary",
        visibility: "public",
        fork: false,
        archived: false,
        disabled: false,
        pushed_at: "2024-01-01T00:00:00Z",
        created_at: "2013-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        license: { spdx_id: "MIT", name: "MIT License" }
      }),
      { status: 200 }
    );
  });
}

beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/github-repo", () => {
  it("returns 200 with expected shape for a valid shorthand", async () => {
    vi.stubGlobal("fetch", mockGitHubFetch());
    const res = await GET(makeRequest("vercel/next.js", "10.0.1.1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      full_name: "vercel/next.js",
      name: "next.js",
      owner: { login: "vercel" },
      languages: { JavaScript: 1234, TypeScript: 5678 }
    });
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=600"
    );
  });

  it("returns 200 for a valid full URL", async () => {
    vi.stubGlobal("fetch", mockGitHubFetch());
    const res = await GET(makeRequest("https://github.com/vercel/next.js", "10.0.1.2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.full_name).toBe("vercel/next.js");
  });

  describe("SSRF / path traversal rejected with 422", () => {
    const cases: Array<[string, string]> = [
      ["../etc", "10.0.2.1"],
      ["owner/..", "10.0.2.2"],
      ["..", "10.0.2.3"],
      [".", "10.0.2.4"],
      ["a/b/c", "10.0.2.5"],
      ["./x", "10.0.2.6"]
    ];

    for (const [input, ip] of cases) {
      it(`rejects "${input}"`, async () => {
        vi.stubGlobal("fetch", mockGitHubFetch());
        const res = await GET(makeRequest(input, ip));
        expect(res.status).toBe(422);
      });
    }
  });

  it("returns 400 when q is missing", async () => {
    vi.stubGlobal("fetch", mockGitHubFetch());
    const url = new URL("http://localhost/api/github-repo");
    const req = new NextRequest(url, { headers: { "x-real-ip": "10.0.3.1" } });
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing q parameter" });
  });

  it("rate-limits requests beyond 30/60s from the same IP with a 429", async () => {
    vi.stubGlobal("fetch", mockGitHubFetch());
    const ip = "203.0.113.42"; // dedicated IP, unused elsewhere, so the in-memory bucket is clean
    for (let i = 0; i < 30; i++) {
      const res = await GET(makeRequest("vercel/next.js", ip));
      expect(res.status).toBe(200);
    }
    const over = await GET(makeRequest("vercel/next.js", ip));
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ error: "Too many requests" });
  });
});
