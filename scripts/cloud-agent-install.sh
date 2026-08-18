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

link_vercel_project() {
  if [[ -z "${VERCEL_TOKEN:-}" ]]; then
    echo "VERCEL_TOKEN not set — skipping vercel link and env pull."
    return 0
  fi

  vercel link --yes \
    --project new-dobeu-net \
    --scope dobeutechnology \
    --token "${VERCEL_TOKEN}"

  vercel env pull .env.local --yes --token "${VERCEL_TOKEN}" || {
    echo "vercel env pull failed (non-fatal); continuing without .env.local"
  }
}

verify_vercel_connect() {
  if [[ -z "${VERCEL_TOKEN:-}" ]]; then
    return 0
  fi

  if vercel connect list --token "${VERCEL_TOKEN}" 2>/dev/null | grep -q .; then
    echo "Vercel Connect connectors are available for this project."
  else
    echo "No Vercel Connect connectors found — run: vercel connect create github"
  fi
}

install_vercel_cli
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
link_vercel_project
verify_vercel_connect
