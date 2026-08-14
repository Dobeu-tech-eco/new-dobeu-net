#!/usr/bin/env bash
set -euo pipefail

export PATH="${HOME}/.local/bin:${PATH}"

if command -v vercel >/dev/null 2>&1 && [[ -n "${VERCEL_TOKEN:-}" ]]; then
  if ! vercel whoami --token "${VERCEL_TOKEN}" >/dev/null 2>&1; then
    echo "VERCEL_TOKEN is set but not valid — vercel whoami failed." >&2
    exit 1
  fi
fi

echo "Cloud agent runtime ready."
