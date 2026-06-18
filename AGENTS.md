# AGENTS.md

Guidance for Codex (and any other `AGENTS.md`-reading agent) in this repository.

**Canonical instructions live in [`CLAUDE.md`](./CLAUDE.md).** Read that file first and treat it as the single source of truth for architecture, commands, security notes, and workflow status.

This file is intentionally a thin pointer because some tools discover instructions by filename. Do not duplicate architectural guidance here.

Sibling pointer files:
- `GEMINI.md`
- `.github/copilot-instructions.md`

If guidance changes, update `CLAUDE.md` and keep this file minimal.

## Learned preferences

These are durable workflow preferences observed across multiple sessions. They are operational (not architectural), so they live here instead of `CLAUDE.md`.

- When the user attaches a plan file from `.cursor/plans/` and says "implement the plan as specified", do NOT edit the plan file itself; its todos are pre-created — mark them `in_progress` as you work and do not recreate them.
- Before reproposing or refreshing any plan, re-read the current codebase first (git status + diff + relevant files). The user has repeatedly corrected attempts to update a plan from prior-session memory or stale context with "review codebase and update plan accordingly".
