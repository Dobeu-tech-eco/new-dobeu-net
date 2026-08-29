# Git and Typeform Budget Consolidation

Date: 2026-08-29

## Goal

End with `main` as the verified production source of truth and `dev` as the
only long-lived development branch. Preserve useful work from every other
remote branch before deleting its pointer. Make Typeform form `wKVKIBe7`
durably capture budget intake without automatically calculating or emailing
client pricing.

## Verified baseline

- Production `main`: `8cb93494c859eb09de2515cf0f40e4b555516130`
- Existing `dev`: `18518832d95fe919fb59d4305d5263c3710cc01e`
- Existing Typeform feature: `3507b5b8283a406e8b8c49d4613a8d921d7bc1b7`
- More complete local Typeform prototype: `346cee1a8b1f31acff0d04502e86d27032289020`
- New visual/Labs requirements branch: `d61a2b904b723a1be7b292e6078a2c059cee4b44`
- Recovery bundle: `C:\\Users\\JeremyWilliams\\repos\\new-dobeu-net-pre-consolidation-20260829.bundle`
- Recovery bundle SHA-256: `697980A1915F7013098EBA37BEC49ED15349A7E4F2C6C0215112E4D203C4BE50`

The bundle passed `git bundle verify` and contains every current remote branch,
the current `main` and `dev`, and both Typeform implementations. Its archive
tags are local only and must not be pushed unless separately approved.

## Branch disposition

| Branch | Disposition |
| --- | --- |
| `main` | Keep; merge only through reviewed PRs. |
| `dev` | Keep; bring forward to current `main`, then use as the release integration branch. |
| `cursor_dev/frontend-visual-labs-plan-8128` | Preserve its unique requirements document in consolidated history. |
| `feat/typeform-estimate-pipeline` | Use only as source material; replace with the review-first budget intake. |
| `backup/2026-07-26` | Preserve in the verified bundle; tenancy work is already superseded on `main`. |
| `cc-dev/vercel-connect-env-0a2b` | Preserve in the bundle; review any still-useful fixes individually and do not merge stale history. |
| `copilot/1c49d1eaccf2a54fdbfcfa45dece75160b581dfe` | Delete after final verification; its workflow patch is already byte-identical on `main`. |
| `dev-vercel-oci` | Delete after approval; strictly behind `main`. |
| `feature/hardening-audit-and-landing-refresh` | Delete after approval; strictly behind `main`. |
| `main-msi` | Preserve in the bundle; its only net difference is stale `AGENTS.md` content. |

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
   family, project summary, timestamps, and a `pending_review` status.
6. Keep the table service-role-only and expose it only through the existing
   MFA-protected admin surface.
7. Return `5xx` when durable storage fails so Typeform retries.
8. Return `2xx` for a duplicate without creating another record or notification.
9. Never calculate or send client pricing automatically.

The existing Make Typeform destination remains enabled until its exact form and
notification behavior is verified. A production canary may create a Typeform
response plus a Linear issue and Slack message, so it remains approval-gated.

## Release gates

- Unit tests cover signature rejection, wrong-form isolation, malformed events,
  required budget extraction, ID fallback, duplicate replay, and storage error.
- TypeScript, lint, Vitest, strict build, and relevant E2E checks pass.
- Preview contains the form ID and webhook secret and accepts a signed synthetic
  payload without pricing or client-email side effects.
- The additive Supabase migration is verified before the production handler is
  enabled.
- Production receives one approved non-PII canary with exactly one durable row.
- Only after production verification are obsolete remote branches deleted and
  `dev` synchronized with final `main`.

## Approval boundary

Local implementation, tests, commits, and the offline recovery bundle are
reversible preparation. Pushing refs, opening or merging PRs, applying database
migrations, changing Vercel or Typeform configuration, submitting a form,
notifying Linear or Slack, deploying, and deleting remote branches require the
explicit external-action approval recorded in the task.
