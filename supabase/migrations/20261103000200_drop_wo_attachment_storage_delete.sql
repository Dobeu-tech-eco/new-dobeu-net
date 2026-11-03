-- =============================================================================
-- Drop the owner DELETE policy on the work-order-attachments bucket (GAP 2).
-- The work_order_attachments table has no DELETE policy, so the storage policy
-- let an owner remove the object and orphan the row. No user-facing code path
-- removes objects from this bucket; the cleanup cron uses the service role.
--
-- Rejected alternative: adding a wo_att_delete_own table policy so owners could
-- delete row and object together. Not needed by any code path, and it would
-- widen the write surface.
-- Re-runnable.
-- =============================================================================
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "wo_attachments_storage_delete_own" on storage.objects;
  end if;
end $$;
