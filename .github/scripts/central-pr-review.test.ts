import { describe, expect, it } from "vitest";
import {
  MAX_COMMENT_CHARS,
  buildCommentBody,
  candidatePrs,
  hasReviewMarker,
  parseRepoList,
  reviewMarker,
  truncateText,
} from "./central-pr-review.mjs";

describe("parseRepoList", () => {
  it("splits on commas and whitespace and de-duplicates ignoring case", () => {
    expect(parseRepoList(" a/one, b/two\nA/One  c/three,,")).toEqual([
      "a/one",
      "b/two",
      "c/three",
    ]);
  });

  it("drops the excluded repo ignoring case", () => {
    expect(parseRepoList("org/self,org/other", "ORG/Self")).toEqual([
      "org/other",
    ]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseRepoList("")).toEqual([]);
    expect(parseRepoList(undefined)).toEqual([]);
  });

  it("rejects entries that are not owner/name", () => {
    expect(() => parseRepoList("good/repo, bad")).toThrow(/owner\/name/);
    expect(() => parseRepoList("a/b/c")).toThrow(/owner\/name/);
  });
});

describe("hasReviewMarker", () => {
  const sha = "abc1234def";
  const bot = { login: "dobeu-bot" };

  it("finds the marker for the same head sha", () => {
    expect(
      hasReviewMarker([{ body: `x\n${reviewMarker(sha)}`, user: bot }], sha),
    ).toBe(true);
  });

  it("ignores markers for an older sha", () => {
    expect(
      hasReviewMarker([{ body: reviewMarker("old"), user: bot }], sha),
    ).toBe(false);
  });

  it("only trusts the reviewer's own comments when a login is given", () => {
    const forged = [{ body: reviewMarker(sha), user: { login: "someone" } }];
    expect(hasReviewMarker(forged, sha, "dobeu-bot")).toBe(false);
    expect(
      hasReviewMarker(
        [{ body: reviewMarker(sha), user: bot }],
        sha,
        "Dobeu-Bot",
      ),
    ).toBe(true);
  });

  it("tolerates comments without a body", () => {
    expect(hasReviewMarker([{ body: null }, {}], sha)).toBe(false);
  });
});

describe("truncateText", () => {
  it("leaves short text alone", () => {
    expect(truncateText("abc", 10)).toEqual({
      text: "abc",
      truncated: false,
      total: 3,
    });
  });

  it("cuts on a line boundary and says how much was shown", () => {
    const diff = "line one\nline two\nline three\n";
    const out = truncateText(diff, 20);
    expect(out.truncated).toBe(true);
    expect(out.text.startsWith("line one\nline two")).toBe(true);
    expect(out.text).toContain(`of ${diff.length} characters shown`);
  });

  it("hard-cuts when there is no usable newline", () => {
    const out = truncateText("x".repeat(100), 10);
    expect(out.text.startsWith("x".repeat(10) + "\n...")).toBe(true);
  });
});

describe("candidatePrs", () => {
  const since = new Date("2026-10-17T00:00:00Z");
  const pr = (number: number, updated: string, extra = {}) => ({
    number,
    state: "open",
    draft: false,
    updated_at: updated,
    ...extra,
  });

  it("keeps open non-draft PRs in the window, newest first", () => {
    const out = candidatePrs(
      [
        pr(1, "2026-10-17T01:00:00Z"),
        pr(2, "2026-10-16T23:00:00Z"),
        pr(3, "2026-10-17T02:00:00Z", { draft: true }),
        pr(4, "2026-10-17T03:00:00Z"),
      ],
      since,
    );
    expect(out.map((p) => p.number)).toEqual([4, 1]);
  });
});

describe("buildCommentBody", () => {
  it("starts with the marker and stays under GitHub's limit", () => {
    const body = buildCommentBody({
      sha: "abcdef1234567",
      review: "y".repeat(MAX_COMMENT_CHARS * 2),
      truncated: true,
      model: "claude-sonnet-5-5",
      runUrl: "https://example.test/run",
    });
    expect(body.startsWith(reviewMarker("abcdef1234567"))).toBe(true);
    expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_CHARS);
    expect(body).toContain("only the first part was reviewed");
  });
});
