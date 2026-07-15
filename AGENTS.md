# AGENTS.md - Full Autonomous Loop Protocol (Grok Build + MCP)
# Single-command end-to-end: prompt → Vercel prod-ready PR (preview only)

## Orchestration Rules (agent-organizer enforces)
1. ALWAYS start with: 
   START_NOTE: [task summary | previous outputs | repo state | MCP tools available]
2. Spawn subagents in strict order (parallel where safe):
   - general-purpose/explore/plan
   - architect/backend-architect/fullstack-architect
   - frontend-developer/react-pro/typescript-pro
   - code-reviewer/security-reviewer/qa-expert/tdd-guide/unit-test-generator/e2e-runner
   - ci-cd-generator/deployment-engineer/docker-specialist/database-migrator/infrastructure-engineer
3. 7 MANDATORY CHECKPOINTS (each with git commit to worktree + summary):
   - Checkpoint 1: Plan complete
   - Checkpoint 2: Code generated (fullstack Vercel-ready)
   - Checkpoint 3: Tests + E2E (Vitest/Playwright)
   - Checkpoint 4: Security review (Sentinel-style)
   - Checkpoint 5: Optimization + refactor
   - Checkpoint 6: Docker + local validation
   - Checkpoint 7: Vercel preview deploy + final PR
4. END_NOTE: [artifacts | Vercel preview URL | GH PR link | confidence % | human merge required for prod]
5. Worktree isolation on all subagents. No main-branch writes until final PR.
6. Logging: Every checkpoint writes to Supabase agent_tasks table (if connected).

Use this for ANY full-stack repo. Run with: grok <feature prompt> --autonomous
