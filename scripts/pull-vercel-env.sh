#!/usr/bin/env bash
set -euo pipefail

export PATH="${HOME}/.local/bin:${PATH}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

OUT_FILE="${1:-.env.local}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN not set — cannot run vercel env pull."
  echo "Add a Vercel token to Cloud Agent secrets, then re-run: bash scripts/pull-vercel-env.sh"
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  mkdir -p "${HOME}/.local/bin"
  npm config set prefix "${HOME}/.local" >/dev/null
  npm install -g vercel@latest
fi

vercel link --yes \
  --project new-dobeu-net \
  --scope dobeutechnology \
  --token "${VERCEL_TOKEN}"

vercel env pull "${OUT_FILE}" --yes --token "${VERCEL_TOKEN}"

echo "Pulled Vercel development env vars into ${OUT_FILE}"
