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
wanted.

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
| `invoice.void_unsent` | Void unsent button (open invoice with no Stripe id) |
| `invoice.create_stripe_failed` | Stripe failed after the local row was inserted (target = the unsent invoice) |
| `invoice.link_failed` | invoice created but not back-linked onto its work order |
| `project.create`, `project.update`, `project.delete` | project admin writes |
| `user.invite`, `user.update` | user admin writes |
| `script.invite_test_customer` | `scripts/invite-test-customer.mjs --apply` |
| company actions | `lib/actions/companies.ts` |

## (g) Invoice guard messages: remaining manual remedies

The invoice actions refuse or warn with messages that point at a manual step.
Each is listed here with what to do. Run SQL in the Supabase SQL editor as the
service role; nothing here needs a secret value.

| Message says | Meaning | Remedy |
| --- | --- | --- |
| "Invoice X was created but could not be linked to the work order" (`invoice.link_failed`) | The invoice exists (and the client was emailed) but `work_orders.invoice_id` is still null. | To keep it: `update work_orders set invoice_id = 'X' where id = '<work order id>' and invoice_id is null;` then reload the ticket page. To bill again instead: void it in the Stripe dashboard (find it on `/admin/invoices`), wait for the webhook to mark it void, then bill again. |
| "An earlier billing record ... has no invoice id ... (unknown invoice)" | An `admin_audit_log` billing row for this work order has a null `target_id`, so the guard cannot tell what was billed and refuses. | Read the rows: `select created_at, action, target_id, data from admin_audit_log where data->>'work_order_id' = '<work order id>' order by created_at;`. Find the invoice on `/admin/invoices` and decide. If it is real, link it (as above). If nothing was billed, void any stray invoice and ask an engineer to fix the audit row; the guard fails safe until then. |
| "Invoice X is already billed for this work order" | A non-void invoice is linked or audited for it. | Void it in the Stripe dashboard and wait for the webhook, or leave it as the bill. |
| "... failed at Stripe and left unsent invoice X" / "An unsent invoice for this client and amount already exists" | The Stripe call failed after the local row was inserted, so the row is `open` with no Stripe id. | First check the Stripe dashboard for this customer: a Stripe error does not prove no Stripe invoice exists, and a re-bill within 24 hours reuses the same request safely. Then use the **Void unsent** button on that row in `/admin/invoices` (admin with AAL2; writes `invoice.void_unsent`), then create the invoice again. Stripe may refuse a different amount for up to 24 hours after the failed attempt. The button refuses rows that have a Stripe id or are not open. |

`invoices.stripe_invoice_id` is unique when set (partial unique index
`invoices_stripe_invoice_id_key`). If its migration ever fails with "duplicated
value(s)", find them with
`select stripe_invoice_id, array_agg(id) from invoices where stripe_invoice_id is not null group by 1 having count(*) > 1;`,
resolve the extra rows by hand, and re-run the migration.
