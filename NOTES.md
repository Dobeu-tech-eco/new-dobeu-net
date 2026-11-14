# Notes on Jeremy's world

Raw notes for `/loop-me`. Workflow specs in `workflows/*.md` are the source of truth; this file holds the vocabulary and tools they lean on. Seeded 2026-11-11 from the repo and the request that opened the session; lines marked (unconfirmed) have not been checked with Jeremy.

## Canonical terms

- **Ledger**: the check-in list, meaning the end-state Sections table, the Acceptance boxes and the open rows of `.harness/action-items.md`. `/dt:check-in` prints it as `N of M complete`.
- **Onboarding ledger**: the ledger as it stood at the first check-in of a session. On 2026-11-11 it held 128 items, 84 complete and 44 outstanding.
- **Item**: one ledger row. Ids: section number, `S` secret, `D` decision, `H` human handoff, `Y` deploy step.
- **Head**: the session that plans lanes, answers sons, merges and reports. It never edits lane files.
- **Son**: a headless autopilot session working one lane in its own worktree. Jeremy's standard is five sons at once.
- **Lane**: one item, or a bundle of items, with an exclusive file set.
- **Receipt**: the change receipt `/dt:ship` writes into the PR body and `.harness/runs/ship-<stamp>/receipt.md`.
- **Hanging PR**: an open PR that is not merged. Jeremy's limit is one, and only when it is blocked by a real issue.
- **Live**: merged to `main` and served by the Vercel production deploy at https://dobeu.net.
- **Headless check**: Playwright or curl against the deployed site with no visible browser.
- **Browser check**: driven browser automation with screenshots, run after the headless check passes.
- **Done**: live, headless check passed, browser check passed, ledger row closed, lessons and incidents folded upstream. Tests passing alone is not done.
- **Listeners**: grokbot, chatgpt and duo, three agents Jeremy says poll for notices about secrets the head cannot handle. Their channel is (unconfirmed).
- **Best time of day**: (unconfirmed) the hour a GTM action should happen. Which actions and which clock are open.

## Tools and channels

- Harness: dts2 plugin 5.2.0 (`/dt:ship`, `/dt:check-in`, `/dt:fullauto`, `/dt:pr-sweep`, `/dt:gtm`, `/dt:loop`, `/dt:learn`, `/dt:incidents`, `/dt:knowledge`).
- Repo host and CI: GitHub Actions (`Verify`, `E2E`, `Lighthouse`, `gitleaks`, `pnpm audit`, `claude-review`), Vercel previews and production.
- Database: Supabase. Production migrations are applied by hand and need Jeremy's yes each time.
- Policy hooks: `vercel env` is denied to agents, so secret presence in Vercel cannot be read by the head.
- Knowledge store: none on this machine yet. Jeremy wants a Cloudflare Worker and D1 store.
- Models: Claude leads; Codex, Gemini, Grok, Copilot and Muse are on the roster for votes and builds.

## Standing preferences heard

- Every change goes out through `/dt:ship` with a receipt.
- Merge after CI is green; do not leave PRs open.
- Test visually twice: headless first, then browser automation.
- Run `/dt:learn` and `/dt:incidents` after each completed item.
