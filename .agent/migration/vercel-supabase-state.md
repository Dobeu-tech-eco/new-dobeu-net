# Vercel Supabase — Migration State Verification

**Generated:** 2026-06-04T20:32:33.459Z
**Host:** `aws-1-us-east-1.pooler.supabase.com:5432`

## Tables (public)

- `bookings`
- `invoices`
- `leads`
- `page_events`
- `profiles`
- `project_files`
- `projects`
- `work_order_attachments`
- `work_orders`

## Enums

- `aal_level`
- `booking_status`
- `buckettype`
- `code_challenge_method`
- `factor_status`
- `factor_type`
- `invoice_status`
- `lead_source`
- `oauth_authorization_status`
- `oauth_client_type`
- `oauth_registration_type`
- `oauth_response_type`
- `one_time_token_type`
- `project_status`
- `work_order_priority`
- `work_order_service_type`
- `work_order_status`

## `public.invoices` columns

- `id`
- `project_id`
- `amount_cents`
- `currency`
- `status`
- `stripe_invoice_id`
- `stripe_payment_intent`
- `due_date`
- `paid_at`
- `created_at`
- `hosted_invoice_url`

## Storage buckets

- `project-files`
- `work-order-attachments`

## Verification checks

| Check | Result |
|---|---|
| initial_schema_present | ✅ |
| missing_base_tables | _(none)_ |
| messages_table_present | ❌ |
| work_orders_present | ✅ |
| work_order_attachments_present | ✅ |
| invoices_hosted_invoice_url_present | ✅ |
| work_order_attachments_bucket_present | ✅ |
| project_files_bucket_present | ✅ |
| initial_schema_applied | ✅ |
| reconciliation_migration_applied | ✅ |

## State summary

- Initial schema (`20260521000000`) applied: **YES**
- Reconciliation (`20260605000000`) applied: **YES**
