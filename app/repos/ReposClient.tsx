"use client";

import { useState, useRef, FormEvent, KeyboardEvent } from "react";
import Image from "next/image";
import {
  Star,
  GitFork,
  Eye,
  AlertCircle,
  ExternalLink,
  Globe,
  Lock,
  Archive,
  X,
  Plus,
  Clock,
  Github,
} from "lucide-react";
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
    <article className="relative group rounded-xl border border-border bg-card p-5 flex flex-col gap-4 transition-all duration-200 hover:border-primary/30 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_4px_24px_hsl(var(--primary)/0.08)]">
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${repo.full_name}`}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 pr-7">
        <a href={repo.owner.html_url} target="_blank" rel="noreferrer" tabIndex={-1} className="flex-shrink-0">
          <Image
            src={repo.owner.avatar_url}
            alt={repo.owner.login}
            width={36}
            height={36}
            className="rounded-lg border border-border"
          />
        </a>
        <div className="min-w-0 flex-1">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="font-display font-bold text-base leading-tight hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap"
          >
            {repo.full_name}
            <ExternalLink className="h-3 w-3 opacity-40 flex-shrink-0" aria-hidden="true" />
          </a>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {repo.archived && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-500 font-medium">
                <Archive className="h-3 w-3" aria-hidden="true" />
                Archived
              </span>
            )}
            {repo.visibility === "private" ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Private
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/60 capitalize">{repo.visibility}</span>
            )}
            {repo.fork && <span className="text-xs text-muted-foreground/60">Fork</span>}
            {repo.license && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
                {repo.license.spdx_id}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {repo.description}
        </p>
      )}

      {/* Topics */}
      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 8).map((t) => (
            <Badge
              key={t}
              className="text-xs px-2 py-0.5 font-normal rounded-md bg-primary/8 text-primary border-transparent hover:bg-primary/14"
            >
              {t}
            </Badge>
          ))}
          {repo.topics.length > 8 && (
            <span className="text-xs text-muted-foreground self-center">
              +{repo.topics.length - 8}
            </span>
          )}
        </div>
      )}

      {/* Language bar */}
      {topLangs.length > 0 && (
        <div>
          <div
            className="flex h-1.5 rounded-full overflow-hidden gap-px"
            role="img"
            aria-label="Language breakdown"
          >
            {topLangs.map(([lang, bytes]) => (
              <div
                key={lang}
                style={{
                  width: `${(bytes / totalBytes) * 100}%`,
                  backgroundColor: langColor(lang),
                }}
                title={`${lang}: ${Math.round((bytes / totalBytes) * 100)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {topLangs.slice(0, 5).map(([lang, bytes]) => (
              <span key={lang} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: langColor(lang) }}
                  aria-hidden="true"
                />
                {lang}
                <span className="opacity-50">{Math.round((bytes / totalBytes) * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/60 pt-3 mt-auto flex-wrap">
        <span className="flex items-center gap-1 tabular-nums">
          <Star className="h-3.5 w-3.5" aria-hidden="true" />
          {formatCount(repo.stargazers_count)}
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <GitFork className="h-3.5 w-3.5" aria-hidden="true" />
          {formatCount(repo.forks_count)}
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {formatCount(repo.watchers_count)}
        </span>
        {repo.open_issues_count > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {formatCount(repo.open_issues_count)}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {repo.homepage && (
            <a
              href={repo.homepage}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              Site
            </a>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {timeAgo(repo.pushed_at)}
          </span>
        </div>
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
    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSubmit();
  }

  function removeRepo(id: number) {
    setRepos((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <section className="container max-w-5xl py-16 md:py-24">
      {/* Page header */}
      <div className="mb-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
          Tools
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-balance mb-3">
          GitHub Repo Viewer
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Paste a full GitHub URL or{" "}
          <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded-md">
            owner/repo
          </code>{" "}
          shorthand. Instantly see stats, language breakdown, topics, and more.
        </p>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mb-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="github.com/owner/repo  or  owner/repo"
          aria-label="GitHub repository URL or owner/repo"
          className="font-mono text-sm flex-1 rounded-xl"
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl gap-1.5"
        >
          {loading ? (
            <>
              <span
                className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              Loading
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add repo
            </>
          )}
        </Button>
      </form>

      {/* Error */}
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive mb-6 mt-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Empty state */}
      {repos.length === 0 && !loading && (
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <div className="h-16 w-16 rounded-2xl border border-border bg-muted/30 flex items-center justify-center">
            <Github className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          </div>
          <p className="font-semibold text-sm">No repos added yet</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            Add a GitHub repo above to see its stats, language breakdown, topics, and last push time.
          </p>
        </div>
      )}

      {/* Grid */}
      {repos.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mb-4 mt-1 tabular-nums">
            {repos.length} repo{repos.length !== 1 ? "s" : ""} linked
          </p>
          <div
            className={cn(
              "grid gap-4",
              repos.length === 1 ? "grid-cols-1 max-w-xl" : "md:grid-cols-2"
            )}
          >
            {repos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} onRemove={() => removeRepo(repo.id)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
