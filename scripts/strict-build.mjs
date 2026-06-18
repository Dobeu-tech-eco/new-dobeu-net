#!/usr/bin/env node
/**
 * Strict build wrapper: runs `next build`, mirrors output live, and fails if
 * specific Vercel/Next.js warnings reappear. Wired up via `pnpm build:strict`
 * (used by `pnpm verify`). Does NOT replace `pnpm build` — Vercel still calls
 * the plain build script so a stray harmless warning never blocks production.
 *
 * Add a regex to BLOCKED_PATTERNS to extend coverage; remove one if a warning
 * becomes intentional. See CLAUDE.md (Conventions) for policy details.
 */
import { spawn } from "node:child_process";

const BLOCKED_PATTERNS = [
  /Detected "engines"/,
  /currently disables static generation/
];

const child = spawn("next", ["build"], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32"
});

let buffer = "";

const tee = (stream, target) => {
  stream.on("data", (chunk) => {
    target.write(chunk);
    buffer += chunk.toString();
  });
};

tee(child.stdout, process.stdout);
tee(child.stderr, process.stderr);

child.on("error", (err) => {
  console.error(`[strict-build] Failed to spawn next build: ${err.message}`);
  process.exit(1);
});

child.on("close", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }
  const violations = BLOCKED_PATTERNS.filter((re) => re.test(buffer));
  if (violations.length > 0) {
    console.error("\n[strict-build] Build succeeded but produced blocked warnings:");
    for (const re of violations) {
      console.error(`  - ${re.source}`);
    }
    console.error(
      "\nFix the source or update scripts/strict-build.mjs if the warning is intentional."
    );
    process.exit(1);
  }
  console.log("[strict-build] No blocked warnings detected.");
});
