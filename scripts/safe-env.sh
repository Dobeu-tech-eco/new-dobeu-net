#!/bin/sh
# Whitelist-only subprocess env (env -i): no app integration credentials, no
# NEXT_PUBLIC_* provider identifiers, no unrelated tokens. Used by the pre-commit
# hook. Runs in the repo root of the CURRENT checkout, so it works in worktrees.
# Usage: scripts/safe-env.sh <command> [args...]
cd "$(git rev-parse --show-toplevel)" || exit 97
if ls -a | grep '^\.env' | grep -Fvx '.env.example' | grep -q .; then echo "BLOCKED: env file other than .env.example present" >&2; exit 98; fi
exec env -i \
  PATH="$PATH" HOME="$HOME" USER="$USER" LOGNAME="$LOGNAME" SHELL="$SHELL" \
  TMPDIR="${TMPDIR:-/tmp}" TERM="${TERM:-dumb}" LANG="${LANG:-en_US.UTF-8}" \
  ${PNPM_HOME:+PNPM_HOME="$PNPM_HOME"} ${COREPACK_HOME:+COREPACK_HOME="$COREPACK_HOME"} \
  NEXT_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 NO_COLOR=1 ${PLAYWRIGHT_JSON_OUTPUT_NAME:+PLAYWRIGHT_JSON_OUTPUT_NAME="$PLAYWRIGHT_JSON_OUTPUT_NAME"} \
  "$@"
