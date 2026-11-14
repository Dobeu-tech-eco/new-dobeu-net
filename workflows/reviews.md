# Workflow: reviews

The loop that takes one built lane from "branch committed" to "done", one PR at a time. Terms are defined in `NOTES.md`.

Status: draft. The open questions at the bottom block an implementer; nothing else does.

## Trigger

Event: a son reports `done` or `incomplete` for a lane (`lanes.py wait` names the lane), or the head finishes a change of its own. No schedule.

## Inputs

- The lane branch, committed and not pushed.
- The lane's ledger item ids.
- The run stamp and manifest under `.harness/runs/<stamp>/`.

## Authority

`.harness/discipline.md` makes pushing, merging to `main`, deploying and deleting branches hard stops, and the policy hook refuses a merge without the owner's grant in `.claude/settings.local.json` (`dts2_approvals`). Only Jeremy adds that grant; the head asks for it by naming the file and the exact change, and never writes it unasked. Invoking `/dt:ship` covers the push and the PR. Step 5 runs unasked only while a standing grant (`"merge_policy": ["auto-when-green"]`) or the PR's number is in that file and `main` is the recorded merge target. Without the grant, step 5 is a checkpoint.

Step 9 writes `.harness/end-state.md`, `.harness/action-items.md` and `.harness/evidence-log.md`. Only the head writes them; a son never does.

## Steps

Each step names the command that does it. A step that fails goes to "Failure paths"; it never skips ahead.

1. **Reconcile.** `lanes.py reconcile <stamp>`. Follow its answer; never open a second PR for one branch.
2. **Ship.** `/dt:ship main` on the lane branch: `pnpm verify`, secret scan, `do_not_touch` check, verifier and reviewer, receipt, PR body, push, open the PR. Link the PR to the thread.
3. **Wait for CI.** `gh pr checks <n> --watch`, capped at 20 minutes. Required green: `Verify`, `E2E`, `Lighthouse`, `gitleaks`, `pnpm audit`, `claude-review`, plus `Build & smoke test` when the PR changes `containers/function/**` (AGENTS.md lists these as merge gates).
4. **Sweep.** `/dt:pr-sweep --run <stamp>`. It merges green PRs of this run, rebases behind ones and reports the rest. It never closes a PR another session owns.
5. **Merge.** Head only: `lanes.py base-health`, `merge-mutex acquire`, rebase on `origin/main`, verifier sign-off on HEAD, `lanes.py merge-go`, wait for the required checks of step 3 to go green on the rebased HEAD, then squash-merge the PR so `main` stays linear (AGENTS.md, Protected history). Never `--admin`; a required check that is red or missing blocks the merge.
6. **Wait for live.** Poll the Vercel production deployment until it serves the squashed commit.
7. **Headless check.** Run the lane's Playwright spec against https://dobeu.net signed out, plus the read-only rows of `scripts/post-merge-smoke.md` that touch the changed routes. Never a row that writes: no form submission, no email, no payment.
8. **Browser check.** Drive the changed screens in browser automation at desktop and phone width, light and dark. Save screenshots to `.harness/runs/<stamp>/<lane>/walkthrough/`.
9. **Close the item.** Set the end-state section to `done`, tick its acceptance boxes, set the action-item row to `done`, and append the evidence to `.harness/evidence-log.md`. Release the mutex and the lease.
10. **Fold upstream.** `/dt:learn`, then `/dt:incidents`.
11. **Next.** `/dt:check-in`; dispatch the next eligible lane; `/dt:gtm` reviews the next step while it builds.

## Checkpoints

Pushed right: with the authority above in place, the head does every step without asking. Jeremy is asked only in these cases, once each, with a brief.

| Case | Why a person | Brief contains |
|---|---|---|
| Merge with no grant on file | Hard stop in `discipline.md` and the policy hook | The PR link, the check results, the file and line to add, one yes/no |
| Production migration (`Y` items) | Writes to live data; each one needs its own yes | The migration file, the pre-check to run, the rollback SQL path, one yes/no |
| Signed-in walk (`H` items) | Needs a real account and TOTP device | The exact steps, the URL, what "pass" looks like |
| A secret the head cannot read or set (`S` items) | Policy denies agents `vercel env` | The variable name, where it is consumed, which environments need it. Never the value |
| Three failed vote rounds and a council that cannot clear the lane | Deadlock | The ballots, the council decision, the parked PR link |

## Brief format

Five lines at most: what was produced, why, what is asked, the default if there is no answer, a link to the asset. Never the raw diff or log.

## Failure paths

- **Red CI.** Read `gh run view <id> --log-failed`; send the lane back to its son (`lanes.py sendback`, at most two). A third failure parks the lane with its PR as the one hanging PR.
- **Second lane ready while a PR hangs.** It waits at "committed, not pushed". The limit of one hanging PR holds.
- **Headless or browser check fails after merge.** `lanes.py fix-attempt`, at most two fixes, then one revert PR under the same gate.
- **Policy or tool denial.** Park the item. Never route around the denial.

## Done

The item's ledger row is closed with evidence from steps 7 and 8, production serves the squashed commit, and no PR of the lane is open.

## Open questions

1. Where do the listeners (grokbot, chatgpt, duo) poll, and what message shape do they expect?
2. Does "best time of day" bind merges and deploys, or only GTM actions such as posts and emails? Which timezone?
3. The head cannot reach the production database from this machine. Who applies `Y` migrations, and through which tool?
4. Which account does the browser check sign in as for `/portal` and `/admin` screens, if any?
