"use client";

import { useState, useRef, FormEvent, KeyboardEvent } from "react";
import Image from "next/image";
import { Star, GitFork, Eye, AlertCircle, ExternalLink, Globe, Lock, Archive, X, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RepoData {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string; avatar_url: string; html_url: string };
  description: string | null;
  html_url: string;
  homepage: string | null;
  topics: string[];
  language: string | null;
  languages: Record<string, number>;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  size: number;
  default_branch: string;
  visibility: "public" | "private";
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  pushed_at: string;
  created_at: string;
  updated_at: string;
  license: { spdx_id: string; name: string } | null;
}

// ─── Language colour map (GitHub colours) ────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Ruby: "#701516",
  Java: "#b07219",
  "C#": "#178600",
  "C++": "#f34b7d",
  C: "#555555",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  PHP: "#4F5D95",
  Shell: "#89e051",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  MDX: "#fcb32c",
};

function langColor(lang: string) {
  return LANG_COLORS[lang] ?? "#8b8b8b";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── RepoCard ─────────────────────────────────────────────────────────────────

function RepoCard({ repo, onRemove }: { repo: RepoData; onRemove: () => void }) {
  const totalBytes = Object.values(repo.languages).reduce((a, b) => a + b, 0);
  const topLangs = Object.entries(repo.languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  return (
    <article className="relative group rounded-xl border border-border bg-card p-5 flex flex-col gap-4 transition-shadow hover:shadow-lg">
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${repo.full_name}`}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 pr-6">
        <a href={repo.owner.html_url} target="_blank" rel="noreferrer" tabIndex={-1}>
          <Image
            src={repo.owner.avatar_url}
            alt={repo.owner.login}
            width={36}
            height={36}
            className="rounded-full border border-border flex-shrink-0"
          />
        </a>
        <div className="min-w-0">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="font-display font-bold text-base leading-tight hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap"
          >
            {repo.full_name}
            <ExternalLink className="h-3 w-3 opacity-50 flex-shrink-0" aria-hidden="true" />
          </a>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {repo.archived && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                <Archive className="h-3 w-3" aria-hidden="true" /> Archived
              </span>
            )}
            {repo.visibility === "private" ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" /> Private
              </span>
            ) : (
              <span className="text-xs text-muted-foreground capitalize">{repo.visibility}</span>
            )}
            {repo.fork && <span className="text-xs text-muted-foreground">Fork</span>}
            {repo.license && (
              <span className="text-xs text-muted-foreground">{repo.license.spdx_id}</span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {repo.description}
        </p>
      )}

      {/* Topics */}
      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 10).map((t) => (
            <Badge key={t} className="text-xs px-2 py-0.5 font-normal bg-muted text-muted-foreground hover:bg-muted border-transparent">
              {t}
            </Badge>
          ))}
          {repo.topics.length > 10 && (
            <span className="text-xs text-muted-foreground self-center">
              +{repo.topics.length - 10} more
            </span>
          )}
        </div>
      )}

      {/* Language bar */}
      {topLangs.length > 0 && (
        <div>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5" role="img" aria-label="Language breakdown">
            {topLangs.map(([lang, bytes]) => (
              <div
                key={lang}
                style={{ width: `${(bytes / totalBytes) * 100}%`, backgroundColor: langColor(lang) }}
                title={`${lang}: ${Math.round((bytes / totalBytes) * 100)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {topLangs.slice(0, 5).map(([lang, bytes]) => (
              <span key={lang} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: langColor(lang) }}
                  aria-hidden="true"
                />
                {lang}
                <span className="opacity-60">{Math.round((bytes / totalBytes) * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3 mt-auto flex-wrap">
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          {formatCount(repo.stargazers_count)}
        </span>
        <span className="flex items-center gap-1">
          <GitFork className="h-3.5 w-3.5" aria-hidden="true" />
          {formatCount(repo.forks_count)}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {formatCount(repo.watchers_count)}
        </span>
        {repo.open_issues_count > 0 && (
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {formatCount(repo.open_issues_count)} issues
          </span>
        )}
        {repo.homepage && (
          <a
            href={repo.homepage}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            Site
          </a>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {timeAgo(repo.pushed_at)}
        </span>
      </div>
    </article>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function ReposClient() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<RepoData[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const q = input.trim();
    if (!q) return;

    // Prevent duplicates
    const normalised = q.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
    const already = repos.some(
      (r) => r.full_name.toLowerCase() === normalised.toLowerCase()
    );
    if (already) {
      setError("That repo is already in your list.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/github-repo?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setRepos((prev) => [data, ...prev]);
        setInput("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  function removeRepo(id: number) {
    setRepos((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <section className="container max-w-5xl py-16 md:py-24">
      {/* Hero */}
      <div className="mb-12 max-w-2xl">
        <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-balance mb-4">
          GitHub Repo Viewer
        </h1>
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          Paste a GitHub URL or <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">owner/repo</code> shorthand.
          Instantly see stats, language breakdown, topics, and more.
        </p>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mb-4">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          placeholder="https://github.com/owner/repo  or  owner/repo"
          aria-label="GitHub repository URL or owner/repo"
          className="font-mono text-sm flex-1"
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Loading
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add repo
            </span>
          )}
        </Button>
      </form>

      {/* Error */}
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive mb-6">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Empty state */}
      {repos.length === 0 && !loading && (
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-14 w-14 rounded-2xl border border-border flex items-center justify-center bg-muted/40">
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </div>
          <p className="text-sm font-medium">No repos linked yet</p>
          <p className="text-xs text-center max-w-xs">
            Add a GitHub repo above to see its full stats, language breakdown, topics, and more.
          </p>
        </div>
      )}

      {/* Grid */}
      {repos.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mb-4">
            {repos.length} repo{repos.length !== 1 ? "s" : ""} linked
          </p>
          <div className={cn(
            "grid gap-4",
            repos.length === 1 ? "grid-cols-1 max-w-xl" : "md:grid-cols-2"
          )}>
            {repos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} onRemove={() => removeRepo(repo.id)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
