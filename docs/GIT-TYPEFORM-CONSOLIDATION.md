# Git and Typeform Budget Consolidation

Date: 2026-08-29

## Goal

End with `main` as the verified production source of truth and `dev` as the
only long-lived development branch. Preserve useful work from every other
remote branch before deleting its pointer. Make Typeform form `wKVKIBe7`
durably capture budget intake without automatically calculating or emailing
client pricing.

## Verified baseline

- Current `origin/main`: `9ae8488d95996ec5be6259a8d35466cf027526ef`
  (`#201`; production deployment must be re-verified before release)
- Existing `dev`: `18518832d95fe919fb59d4305d5263c3710cc01e`
- Existing Typeform feature: `3507b5b8283a406e8b8c49d4613a8d921d7bc1b7`
- More complete local Typeform prototype: `346cee1a8b1f31acff0d04502e86d27032289020`
- Visual/Labs branch after its Datadog revert: `c3e082e395923ba952227a23f1b57b6cdd38383a`
- Recovery bundle: `C:\\Users\\JeremyWilliams\\repos\\new-dobeu-net-pre-consolidation-20260829-main201.bundle`
- Recovery bundle SHA-256: `4045E26F4C3D149BE6AEF1E314CC8EAFEB905D2A463DA543DB6C0F845224E5FD`

The refreshed bundle passed `git bundle verify` and records complete history
for all ten current remote heads, current `origin/main`, current `origin/dev`,
the rebased consolidation branch, and both prior Typeform implementations. Its
archive tags are local only and must not be pushed unless separately approved.

## Branch disposition

| Branch                                             | Disposition                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `main`                                             | Keep; merge only through reviewed PRs.                                                                 |
| `dev`                                              | Keep; bring forward to current `main`, then use as the release integration branch.                     |
| `cursor_dev/frontend-visual-labs-plan-8128`        | Delete after verification; visual/Labs landed in `#201`, while this tip reverts Datadog. Do not merge. |
| `feat/typeform-estimate-pipeline`                  | Use only as source material; replace with the review-first budget intake.                              |
| `backup/2026-07-26`                                | Preserve in the verified bundle; tenancy work is already superseded on `main`.                         |
| `cc-dev/vercel-connect-env-0a2b`                   | Preserve in the bundle; review any still-useful fixes individually and do not merge stale history.     |
| `copilot/1c49d1eaccf2a54fdbfcfa45dece75160b581dfe` | Delete after final verification; its workflow patch is already byte-identical on `main`.               |
| `dev-vercel-oci`                                   | Delete after approval; strictly behind `main`.                                                         |
| `feature/hardening-audit-and-landing-refresh`      | Delete after approval; strictly behind `main`.                                                         |
| `main-msi`                                         | Preserve in the bundle; its only net difference is stale `AGENTS.md` content.                          |

Dirty local worktrees and their local branches are outside the destructive
cleanup scope. They must not be reset, cleaned, stashed, detached, or removed.

## Typeform budget intake contract

The live public form already requires `budget_band` (`CL1VxBC3LVkE`) with the
choice refs below:

- `under-2500`
- `2500-5000`
- `5000-10000`
- `10000-25000`
- `25000-50000`
- `50000-plus`
- `guidance-needed`

The production handler must:

1. Verify the Typeform signature against the unmodified request body.
2. Accept only `form_response` events for the configured form ID.
3. Require a response token and persist before acknowledging delivery.
4. Deduplicate on `(form_id, response_token)` before any downstream effect.
5. Store the raw event, extracted contact fields, budget ref/label, service
   family, project summary, timestamps, and a `new` status awaiting admin review.
6. Keep the table service-role-only and expose it only through the existing
   MFA-protected admin surface.
7. Return `5xx` when durable storage fails so Typeform retries.
8. Return `2xx` for a duplicate without creating another record or notification.
9. Never calculate or send client pricing automatically.

The form's Make webhook is now verified as the trigger for active scenario
`DTS Intake → Linear + Slack` (`4894373`). It maps the same contact, service,
budget, and summary refs into one Linear issue and then sends a direct Slack
notification linking that issue. It contains no price calculation or client
email, so it can coexist with the application-owned durable intake queue. A
production canary will create a Typeform response, Linear issue, and Slack
message, so it remains approval-gated.

## Release gates

- Unit tests cover signature rejection, wrong-form isolation, malformed events,
  required budget extraction, ID fallback, duplicate replay, and storage error.
- TypeScript, lint, Vitest, strict build, and relevant E2E checks pass.
- Preview contains the form ID and webhook secret and accepts a signed synthetic
  payload without pricing or client-email side effects.
- Preview and Production expose `NEXT_PUBLIC_TYPEFORM_FORM_ID=wKVKIBe7`; the
  webhook fails closed if that deployment value drifts from its database-bound ID.
- The additive Supabase migration is verified before the production handler is
  enabled.
- Production receives one approved non-PII canary with exactly one durable row.
- Only after production verification are obsolete remote branches deleted and
  `dev` synchronized with final `main`.

## Local verification

The rebased implementation passed TypeScript, changed-file ESLint, all 49
Vitest files (504 tests), `git diff --check`, and the strict production build.
The independent security re-review reported no remaining findings. Applying
the migration to a real Supabase database, Preview verification, and the live
canary remain external approval gates; the local Docker daemon was not running,
so the migration has not been claimed as runtime-verified.

## Approval boundary

Local implementation, tests, commits, and the offline recovery bundle are
reversible preparation. Pushing refs, opening or merging PRs, applying database
migrations, changing Vercel or Typeform configuration, submitting a form,
notifying Linear or Slack, deploying, and deleting remote branches require the
explicit external-action approval recorded in the task.
