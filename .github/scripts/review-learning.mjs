// Weekly review-learning job. Sorts last week's Claude review threads into
// fixed / ignored, asks Claude to turn the pattern into REVIEW.md rules, and
// rewrites only the block between the review-learning markers. The workflow
// opens the PR; this script never pushes.
//
// Usage: node .github/scripts/review-learning.mjs [--dry-run]
// Env: GITHUB_TOKEN, TARGET_REPOSITORY (owner/name; falls back to
// GITHUB_REPOSITORY, which Actions does not let a step override),
// ANTHROPIC_API_KEY (not needed for --dry-run), LOOKBACK_DAYS (7),
// REVIEW_BOT_PATTERN, ANTHROPIC_MODEL. Run it from the target repo's checkout:
// REVIEW.md is read from the current directory.

import { readFile, writeFile, appendFile } from "node:fs/promises";

const REVIEW_FILE = "REVIEW.md";
const START_MARKER = "<!-- review-learning:start -->";
const END_MARKER = "<!-- review-learning:end -->";
const DEFAULT_LOOKBACK_DAYS = 7;
const DEFAULT_BOT_PATTERN = "^(claude|github-actions)(\\[bot\\])?$";
const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_PRS = 50;
const MAX_BODY_CHARS = 600;
const MAX_OUTPUT_TOKENS = 4000;
const MS_PER_DAY = 86_400_000;

const env = process.env;
const dryRun = process.argv.includes("--dry-run");
const [owner, repo] = (
  env["TARGET_REPOSITORY"] ||
  env["GITHUB_REPOSITORY"] ||
  ""
).split("/");
const lookbackDays = Number(env["LOOKBACK_DAYS"] || DEFAULT_LOOKBACK_DAYS);
const botPattern = new RegExp(
  env["REVIEW_BOT_PATTERN"] || DEFAULT_BOT_PATTERN,
  "i",
);
const since = new Date(Date.now() - lookbackDays * MS_PER_DAY);

const THREADS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number title state url
      reviewThreads(first: 100) {
        nodes {
          isResolved isOutdated path line
          comments(first: 10) {
            nodes { author { login } body createdAt }
          }
        }
      }
    }
  }
}`;

async function github(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env["GITHUB_TOKEN"]}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
    },
  });
  if (!res.ok)
    throw new Error(`GitHub ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function recentPullNumbers() {
  const pulls = await github(
    `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${MAX_PRS}`,
  );
  return pulls
    .filter((p) => new Date(p.updated_at) >= since)
    .map((p) => p.number);
}

async function reviewThreads(number) {
  const body = JSON.stringify({
    query: THREADS_QUERY,
    variables: { owner, repo, number },
  });
  const { data, errors } = await github("/graphql", { method: "POST", body });
  if (errors)
    throw new Error(`GraphQL PR #${number}: ${JSON.stringify(errors)}`);
  return data.repository.pullRequest;
}

// A thread is "fixed" when it was resolved or its line changed afterwards
// (GitHub marks it outdated). It is "ignored" only once the PR is merged or
// closed with the thread untouched. Open, untouched threads are still pending.
export function classifyThread(thread, prState) {
  if (thread.isResolved || thread.isOutdated) return "fixed";
  return prState === "OPEN" ? "pending" : "ignored";
}

function isBotThread(thread) {
  const first = thread.comments.nodes[0];
  return Boolean(first?.author && botPattern.test(first.author.login));
}

function toFinding(pr, thread) {
  const [first, ...replies] = thread.comments.nodes;
  return {
    pr: pr.number,
    path: thread.path,
    outcome: classifyThread(thread, pr.state),
    comment: first.body.slice(0, MAX_BODY_CHARS),
    replies: replies
      .filter((r) => r.author && !botPattern.test(r.author.login))
      .map((r) => r.body.slice(0, MAX_BODY_CHARS)),
    createdAt: first.createdAt,
  };
}

async function collectFindings() {
  const numbers = await recentPullNumbers();
  const prs = await Promise.all(numbers.map(reviewThreads));
  return prs.flatMap((pr) =>
    pr.reviewThreads.nodes
      .filter(isBotThread)
      .map((t) => toFinding(pr, t))
      .filter((f) => f.outcome !== "pending" && new Date(f.createdAt) >= since),
  );
}

const PR_CITATION = /#(\d+)/g;

// PR numbers the model may cite: this week's findings plus any already
// cited in the current learned block (kept rules carry old evidence).
export function allowedPrNumbers(findings, currentBlock) {
  const cited = [...currentBlock.matchAll(PR_CITATION)].map((m) =>
    Number(m[1]),
  );
  return new Set([...findings.map((f) => f.pr), ...cited]);
}

export function unknownCitations(text, allowed) {
  const cited = [...text.matchAll(PR_CITATION)].map((m) => Number(m[1]));
  return [...new Set(cited.filter((n) => !allowed.has(n)))];
}

function buildPrompt(currentBlock, handWritten, findings, allowed) {
  return [
    "You maintain the auto-learned section of a repository's REVIEW.md, which an AI code reviewer reads.",
    "Below are last week's AI review comments, each marked fixed (the author changed the code or resolved it)",
    "or ignored (the PR merged or closed with the comment untouched). Human replies are included.",
    "",
    "Update the learned section:",
    "- 'Always check': patterns that were repeatedly fixed, phrased as a concrete check.",
    "- 'Stop flagging': patterns that were repeatedly ignored or rebutted by a human reply.",
    "- Only add a rule backed by at least 2 findings, or 1 finding with an explicit human rebuttal.",
    "- Keep existing learned rules unless this week's evidence contradicts them. Never duplicate a hand-written rule.",
    "- Never add a rule that would stop flagging security, auth, payments, age gating or data deletion issues.",
    "- After each rule, add the evidence as `(PR #12, #15)`.",
    `- Cite only these PR numbers, taken from the findings' \`pr\` field: ${[...allowed].map((n) => `#${n}`).join(", ")}. Never write any other #number.`,
    "",
    "Reply with ONLY the markdown that goes between the markers, starting with '## Learned from past reviews'.",
    "",
    "<hand_written_rules>",
    handWritten,
    "</hand_written_rules>",
    "<current_learned_section>",
    currentBlock,
    "</current_learned_section>",
    "<findings>",
    JSON.stringify(findings, null, 2),
    "</findings>",
  ].join("\n");
}

async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env["ANTHROPIC_API_KEY"] ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env["ANTHROPIC_MODEL"] || DEFAULT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok)
    throw new Error(`Anthropic -> ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.content
    .map((c) => c.text ?? "")
    .join("")
    .trim();
}

export function splitReviewFile(text) {
  const start = text.indexOf(START_MARKER);
  const end = text.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${REVIEW_FILE} is missing the review-learning markers`);
  }
  return {
    before: text.slice(0, start + START_MARKER.length),
    block: text.slice(start + START_MARKER.length, end).trim(),
    after: text.slice(end),
  };
}

async function summarize(findings) {
  const fixed = findings.filter((f) => f.outcome === "fixed").length;
  const line = `Review learning: ${findings.length} threads since ${since.toISOString().slice(0, 10)} (${fixed} fixed, ${findings.length - fixed} ignored).`;
  console.log(line);
  if (env["GITHUB_STEP_SUMMARY"])
    await appendFile(env["GITHUB_STEP_SUMMARY"], `${line}\n`);
  if (env["GITHUB_OUTPUT"])
    await appendFile(env["GITHUB_OUTPUT"], `summary=${line}\n`);
}

// The model has invented PR numbers before (chimacomics #58 cited a
// nonexistent #239). Ask once more with the bad numbers named, then fail
// rather than open a PR whose evidence cannot be checked.
async function learnRules(block, handWritten, findings) {
  const allowed = allowedPrNumbers(findings, block);
  const prompt = buildPrompt(block, handWritten, findings, allowed);
  const first = await askClaude(prompt);
  const bad = unknownCitations(first, allowed);
  if (bad.length === 0) return first;
  const retry = await askClaude(
    `${prompt}\n\nYour previous answer cited ${bad.map((n) => `#${n}`).join(", ")}, which are not in the findings. Answer again citing only the allowed PR numbers.`,
  );
  const stillBad = unknownCitations(retry, allowed);
  if (stillBad.length > 0)
    throw new Error(`Model cited unknown PRs: ${stillBad.join(", ")}`);
  return retry;
}

async function main() {
  const findings = await collectFindings();
  await summarize(findings);
  if (dryRun) return console.log(JSON.stringify(findings, null, 2));
  if (findings.length === 0)
    return console.log("Nothing to learn from this week.");
  if (!env["ANTHROPIC_API_KEY"])
    throw new Error("ANTHROPIC_API_KEY secret is not set");

  const text = await readFile(REVIEW_FILE, "utf8");
  const { before, block, after } = splitReviewFile(text);
  const learned = await learnRules(block, before, findings);
  await writeFile(REVIEW_FILE, `${before}\n\n${learned}\n\n${after}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
