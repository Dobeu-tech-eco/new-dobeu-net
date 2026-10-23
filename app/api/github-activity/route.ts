/**
 * app/api/github-activity/route.ts
 *
 * Fetches recent public GitHub events for selected business technology repos
 * and returns a cleaned, display-ready array.
 *
 * Cached for 5 minutes. Upstream failures return a distinct error response.
 */
import { NextResponse } from "next/server";

// nodejs required: Vercel Services does not support Edge Runtime outputs.
export const runtime = "nodejs";
export const revalidate = 300; // 5 minutes

export interface GitHubEvent {
  id: string;
  type: "push" | "pr" | "release" | "star" | "other";
  repo: string;
  message: string;
  timestamp: string;
  url: string;
}

const FEATURED_REPOS = new Set(["Dobeu-tech-eco/new-dobeu-net"]);
const EXCLUDED_COPY = /\b(?:AI|agents?|consult(?:ing|ant|ancy)?)\b/i;

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
  if (!FEATURED_REPOS.has(raw.repo.name)) return null;
  const repoName = raw.repo.name.replace("Dobeu-tech-eco/", "");
  const repoUrl = `https://github.com/${raw.repo.name}`;

  if (raw.type === "PushEvent") {
    const commit = raw.payload.commits?.[0];
    if (!commit || EXCLUDED_COPY.test(commit.message)) return null;
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
    if (!pr || EXCLUDED_COPY.test(pr.title)) return null;
    return {
      id: raw.id,
      type: "pr",
      repo: repoName,
      message: pr.title.slice(0, 72),
      timestamp: raw.created_at,
      url: repoUrl,
    };
  }

  if (raw.type === "ReleaseEvent") {
    const rel = raw.payload.release;
    if (!rel || EXCLUDED_COPY.test(rel.name)) return null;
    return {
      id: raw.id,
      type: "release",
      repo: repoName,
      message: `Released ${rel.name}`,
      timestamp: raw.created_at,
      url: repoUrl,
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
      },
    );

    if (!res.ok) {
      console.warn("GitHub activity unavailable", res.status);
      return NextResponse.json(
        { error: "GitHub activity unavailable." },
        { status: 502 },
      );
    }

    const raw = await res.json();
    const events: GitHubEvent[] = [];

    for (const item of raw) {
      if (events.length >= 6) break;
      const parsed = parseEvent(item);
      if (parsed) events.push(parsed);
    }

    return NextResponse.json(events, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    console.warn("GitHub activity unavailable");
    return NextResponse.json(
      { error: "GitHub activity unavailable." },
      { status: 502 },
    );
  }
}
