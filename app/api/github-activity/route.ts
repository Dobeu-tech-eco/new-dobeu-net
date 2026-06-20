/**
 * app/api/github-activity/route.ts
 *
 * Fetches the last 6 public GitHub events for the Dobeu-tech-eco org
 * and returns a cleaned, display-ready array.
 *
 * Cached for 5 minutes at the edge — zero cost, always fresh enough.
 * Falls back to static data if GitHub rate-limits or is unreachable.
 */
import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 300; // 5 minutes

export interface GitHubEvent {
  id: string;
  type: "push" | "pr" | "release" | "star" | "other";
  repo: string;
  message: string;
  timestamp: string;
  url: string;
}

const FALLBACK_EVENTS: GitHubEvent[] = [
  {
    id: "fallback-1",
    type: "push",
    repo: "monty-ai-fullstackdev-coder",
    message: "feat: add autonomous test runner loop",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    url: "https://github.com/Dobeu-tech-eco/monty-ai-fullstackdev-coder",
  },
  {
    id: "fallback-2",
    type: "push",
    repo: "unified-ai-v1",
    message: "fix: streaming response edge timeout",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    url: "https://github.com/Dobeu-tech-eco/unified-ai-v1",
  },
  {
    id: "fallback-3",
    type: "push",
    repo: "dts-contract-engine",
    message: "feat: Stripe invoice auto-send on contract sign",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    url: "https://github.com/Dobeu-tech-eco/dts-contract-engine",
  },
];

function parseEvent(raw: {
  id: string;
  type: string;
  repo: { name: string; url?: string };
  payload: {
    commits?: Array<{ message: string }>;
    pull_request?: { title: string; html_url?: string };
    release?: { name: string; html_url?: string };
  };
  created_at: string;
}): GitHubEvent | null {
  const repoName = raw.repo.name.replace("Dobeu-tech-eco/", "");
  const repoUrl = `https://github.com/${raw.repo.name}`;

  if (raw.type === "PushEvent") {
    const commit = raw.payload.commits?.[0];
    if (!commit) return null;
    return {
      id: raw.id,
      type: "push",
      repo: repoName,
      message: commit.message.split("\n")[0].slice(0, 72),
      timestamp: raw.created_at,
      url: repoUrl,
    };
  }

  if (raw.type === "PullRequestEvent") {
    const pr = raw.payload.pull_request;
    if (!pr) return null;
    return {
      id: raw.id,
      type: "pr",
      repo: repoName,
      message: pr.title.slice(0, 72),
      timestamp: raw.created_at,
      url: pr.html_url ?? repoUrl,
    };
  }

  if (raw.type === "ReleaseEvent") {
    const rel = raw.payload.release;
    if (!rel) return null;
    return {
      id: raw.id,
      type: "release",
      repo: repoName,
      message: `Released ${rel.name}`,
      timestamp: raw.created_at,
      url: rel.html_url ?? repoUrl,
    };
  }

  return null;
}

export async function GET() {
  try {
    const res = await fetch(
      "https://api.github.com/users/dobeutech/events/public?per_page=30",
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "dobeu-net-site/1.0",
          // GITHUB_TOKEN is optional — public events work unauthenticated at
          // 60 req/hr. With a token it's 5000 req/hr.
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      return NextResponse.json(FALLBACK_EVENTS);
    }

    const raw = await res.json();
    const events: GitHubEvent[] = [];

    for (const item of raw) {
      if (events.length >= 6) break;
      const parsed = parseEvent(item);
      if (parsed) events.push(parsed);
    }

    return NextResponse.json(events.length > 0 ? events : FALLBACK_EVENTS, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json(FALLBACK_EVENTS);
  }
}
