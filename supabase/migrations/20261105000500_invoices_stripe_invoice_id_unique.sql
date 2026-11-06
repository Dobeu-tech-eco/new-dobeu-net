-- =============================================================================
-- Unique invoices.stripe_invoice_id when set (2026-11-05, D39)
-- -----------------------------------------------------------------------------
-- Unsent invoices (the Stripe call failed after the local insert) carry a NULL
-- stripe_invoice_id and any number of them may exist, so the index is partial.
-- A real Stripe invoice id must map to exactly one local row; the webhook and
-- the reuse lookup in lib/invoice-creation.ts both assume it.
--
-- Never skips silently: if duplicates exist the migration FAILS and reports how
-- many ids are duplicated. Decide by hand which row to keep (void or delete the
-- others), then re-run.
-- =============================================================================

do $$
declare
  v_dup_ids  bigint;
  v_dup_rows bigint;
begin
  select count(*), coalesce(sum(n), 0)
    into v_dup_ids, v_dup_rows
  from (
    select count(*) as n
    from public.invoices
    where stripe_invoice_id is not null
    group by stripe_invoice_id
    having count(*) > 1
  ) d;

  if v_dup_ids > 0 then
    raise exception
      'invoices.stripe_invoice_id has % duplicated value(s) across % rows; resolve the duplicate rows before creating invoices_stripe_invoice_id_key',
      v_dup_ids, v_dup_rows;
  end if;
end $$;

create unique index if not exists invoices_stripe_invoice_id_key
  on public.invoices (stripe_invoice_id)
  where stripe_invoice_id is not null;
