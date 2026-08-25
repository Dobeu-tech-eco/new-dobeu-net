#!/usr/bin/env bash
set -euo pipefail

export PATH="${HOME}/.local/bin:${PATH}"

install_vercel_cli() {
  if command -v vercel >/dev/null 2>&1; then
    return 0
  fi

  mkdir -p "${HOME}/.local/bin"
  npm config set prefix "${HOME}/.local" >/dev/null
  npm install -g vercel@latest
}

install_vercel_cli
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  bash scripts/pull-vercel-env.sh .env.local || echo "vercel env pull failed (non-fatal); continuing without .env.local"
else
  echo "VERCEL_TOKEN not set — skipping vercel env pull (.env.local unchanged)."
  echo "GitHub access: use Composio MCP (github toolkit, account github_big-lain for Dobeu-tech-eco)."
fi
