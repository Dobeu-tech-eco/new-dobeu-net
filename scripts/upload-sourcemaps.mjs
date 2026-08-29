#!/usr/bin/env node
/**
 * Post-build step: upload browser source maps to Datadog, then delete them from
 * the build output so they are never served publicly.
 *
 * Wired into `pnpm build` (which is what Vercel runs), so every deployment that
 * has DATADOG_API_KEY configured gets deminified RUM stack traces.
 *
 * Behaviour:
 *   - No DATADOG_API_KEY  -> skip the upload, still delete the maps.
 *   - Key present         -> `datadog-ci sourcemaps upload`, then delete.
 *
 * The `--release-version` MUST match the `version` passed to datadogRum.init()
 * in lib/datadog.ts (the short commit SHA), or Datadog cannot pair a stack
 * trace with its map. See docs/datadog-sourcemaps.md.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const STATIC_DIR = join(process.cwd(), ".next", "static");
const SERVICE = process.env.NEXT_PUBLIC_DATADOG_SERVICE || "dobeu-net";
const MINIFIED_PATH_PREFIX = "/_next/static";

function shortSha() {
  const explicit = process.env.NEXT_PUBLIC_DATADOG_VERSION;
  if (explicit) return explicit;
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  const git = spawnSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" });
  return git.status === 0 ? git.stdout.trim() : null;
}

function collectMaps(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectMaps(full));
    else if (entry.endsWith(".map")) out.push(full);
  }
  return out;
}

function main() {
  if (!existsSync(STATIC_DIR)) {
    console.log("[datadog] no .next/static directory — nothing to do.");
    return;
  }

  const maps = collectMaps(STATIC_DIR);
  if (maps.length === 0) {
    console.log("[datadog] no source maps found (productionBrowserSourceMaps off?).");
    return;
  }

  const apiKey = process.env.DATADOG_API_KEY;
  const version = shortSha();

  if (!apiKey) {
    console.log(
      `[datadog] DATADOG_API_KEY not set — skipping upload, deleting ${maps.length} source map(s).`
    );
  } else if (!version) {
    console.warn("[datadog] could not determine a version — skipping upload.");
  } else {
    console.log(`[datadog] uploading ${maps.length} source map(s) as ${SERVICE}@${version}`);
    const result = spawnSync(
      "pnpm",
      [
        "exec",
        "datadog-ci",
        "sourcemaps",
        "upload",
        ".next/static",
        `--service=${SERVICE}`,
        `--release-version=${version}`,
        `--minified-path-prefix=${MINIFIED_PATH_PREFIX}`
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          DATADOG_SITE: process.env.DATADOG_SITE || process.env.NEXT_PUBLIC_DATADOG_SITE || "datadoghq.com"
        },
        shell: process.platform === "win32"
      }
    );
    // Observability must never break a deploy.
    if (result.status !== 0) {
      console.warn("[datadog] source map upload failed — continuing with the build.");
    }
  }

  for (const map of maps) rmSync(map, { force: true });
  console.log(`[datadog] removed ${maps.length} source map(s) from the build output.`);
}

main();
