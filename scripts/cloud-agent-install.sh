#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

corepack enable
pnpm install --frozen-lockfile

# Optional: link the Vercel project and pull env when VERCEL_TOKEN is configured
# in Cloud Agent secrets. Enables `vercel env pull` (OIDC token) and `vercel connect`.
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  if [[ ! -f .vercel/project.json ]]; then
    pnpm exec vercel link --yes --project new-dobeu-net --scope dobeutechnology
  fi
  pnpm exec vercel env pull .env.local --yes --environment=development
fi
