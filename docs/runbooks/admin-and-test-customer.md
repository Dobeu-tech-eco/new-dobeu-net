# Runbook: admin access and the test customer

Covers the admin allowlist, admin sign-in with MFA, creating the test customer
(`jswilliamstu@gmail.com`), and what the audit log records. Nothing here prints a
secret value.

## (a) ADMIN_EMAILS

Status: `ADMIN_EMAILS` was set to exactly `jeremyw@dobeu.net` (Sensitive) in
Vercel Production and Preview on 2026-11-04 02:45 UTC, on Jeremy's instruction.
It takes effect on the next deploy of each environment.

Verify with metadata only (names and timestamps, never values):

```bash
vercel env ls production | grep -c '^ *ADMIN_EMAILS'   # expect 1
vercel env ls preview    | grep -c '^ *ADMIN_EMAILS'   # expect 1
vercel api /v10/projects/new-dobeu-net/env \
  | jq '.envs[] | select(.key=="ADMIN_EMAILS") | {key,target,type,updatedAt}'   # never shows a value
```

Do not run `vercel env pull` to check a Sensitive variable: the pull returns a
placeholder, not the value. Never read-modify-write it. To change it, set the
whole value again in the dashboard (or `vercel env add`). Jeremy confirms the
exact membership in the dashboard.

The invite script's `ADMIN_EMAILS` refusal reads the LOCAL environment only
(shell or `.env.local`). It cannot see Vercel's value.

## (b) Admin sign-in and MFA

1. Sign in at `/login` with the magic link sent to `jeremyw@dobeu.net`.
2. An admin without AAL2 is sent to `/portal/settings/mfa`. Enroll a TOTP
   authenticator there, then verify the code.
3. Open `/admin`. After enrollment the session is AAL2 and `/admin` loads.

A non-allowlisted account (the test customer) requesting `/admin` is redirected
to `/portal`.

## (c) Create the test customer with the script

Always dry-run first. Nothing is written without `--apply`.

```bash
# Local stack first
node scripts/invite-test-customer.mjs jswilliamstu@gmail.com --with-company
node scripts/invite-test-customer.mjs jswilliamstu@gmail.com --with-company --apply
```

Production only with Jeremy's OK: export the production Supabase URL and service
role key in your shell for the one command (never write them to a file in the
repo), run the dry run, read the planned steps, then repeat with `--apply`.

Behavior:

- Invite-based (`inviteUserByEmail`); no password, no email confirmation shortcut.
- Idempotent: an existing user is not re-invited; the "Test Customer" company is
  found by exact name before it is created; the membership is upserted at the
  lowest-rank role.
- Refuses any address in the local `ADMIN_EMAILS`, and refuses `--apply` when
  `ADMIN_EMAILS` is unset.
- Prints the target host, planned steps and resulting ids only. It writes an
  `admin_audit_log` row (`script.invite_test_customer`) on apply.

## (d) Alternative: invite from the admin UI

Signed in as an admin with AAL2, use `/admin/users` to invite the address. Add the
customer to a company from the company admin screens if a company-scoped test is
wanted. Company-member invites (`inviteMember`) create an `invited` row and send a
fixed-copy email: the invitee signs in with the invited email address using an
emailed sign-in link (made after the invite was sent) and clicks Accept under
"Pending company invites" on `/portal` (Decline removes the row; an admin can
re-invite). Until they accept, they are not an active member. An existing account
that has signed in before must have signed in with an emailed link at its current
email address (after any email change) before an admin can invite it; otherwise the invite is refused and they should sign in once
at the login page using the emailed link first. A password set earlier keeps working
after accept.
`provisionCompanyAdmin` is unchanged (a new address gets a Supabase invite link, an
existing address is inserted active); its invited rows can also be accepted from
`/portal`, and aligning it with this flow is D49.

## (e) Stripe stays in test mode

Use `sk_test_` keys only for this exercise. Create test invoices from
`/admin/invoices`, and mark them paid manually; do not pay with a real card or
send live invoices.

## (f) Audit-log actions

Rows land in `admin_audit_log` (service role only; clients have no grants).
`data` holds ids, amounts and statuses, never emails, tokens or Stripe secrets.

| Action | Written by |
| --- | --- |
| `work_order.create_for_client` | post work for a client |
| `work_order.quote`, `work_order.status` | quote and status changes |
| `invoice.create`, `invoice.create_for_work_order` | invoice creation |
| `invoice.mark_paid_manual` | manual mark-paid (records previous status) |
| `project.create`, `project.update`, `project.delete` | project admin writes |
| `user.invite`, `user.update` | user admin writes |
| `script.invite_test_customer` | `scripts/invite-test-customer.mjs --apply` |
| company actions | `lib/actions/companies.ts` |
