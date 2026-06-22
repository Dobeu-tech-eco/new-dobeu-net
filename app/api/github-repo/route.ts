import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/** Parse owner/repo from a GitHub URL or "owner/repo" shorthand. */
function parseGitHubRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\/$/, "");

  // Shorthand: owner/repo
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    const [owner, repo] = trimmed.split("/");
    return { owner, repo };
  }

  // Full URL: https://github.com/owner/repo
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Missing q parameter" }, { status: 400 });
  }

  const parsed = parseGitHubRepo(q);
  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse a GitHub owner/repo from that input." },
      { status: 422 }
    );
  }

  const { owner, repo } = parsed;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const [repoRes, languagesRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers }),
  ]);

  if (repoRes.status === 404) {
    return NextResponse.json({ error: "Repository not found." }, { status: 404 });
  }
  if (!repoRes.ok) {
    return NextResponse.json(
      { error: `GitHub API error: ${repoRes.status}` },
      { status: 502 }
    );
  }

  const data = await repoRes.json();
  const languages = languagesRes.ok ? await languagesRes.json() : {};

  // Return only the fields we need — keep payload small
  return NextResponse.json(
    {
      id: data.id,
      full_name: data.full_name,
      name: data.name,
      owner: {
        login: data.owner.login,
        avatar_url: data.owner.avatar_url,
        html_url: data.owner.html_url,
      },
      description: data.description,
      html_url: data.html_url,
      homepage: data.homepage,
      topics: data.topics ?? [],
      language: data.language,
      languages,
      stargazers_count: data.stargazers_count,
      forks_count: data.forks_count,
      open_issues_count: data.open_issues_count,
      watchers_count: data.watchers_count,
      size: data.size,
      default_branch: data.default_branch,
      visibility: data.visibility,
      fork: data.fork,
      archived: data.archived,
      disabled: data.disabled,
      pushed_at: data.pushed_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      license: data.license
        ? { spdx_id: data.license.spdx_id, name: data.license.name }
        : null,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
