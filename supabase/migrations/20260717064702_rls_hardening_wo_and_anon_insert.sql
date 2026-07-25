-- =============================================================================
-- dobeu.net v3 — RLS hardening: work-order tampering + anon insert bypass
-- (2026-07-17, from the production-hardening audit)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. work_orders: drop the client-side UPDATE policy entirely.
--
--    `wo_update_accept_quote` (20260605000000) only re-asserted ownership in
--    WITH CHECK (`created_by = auth.uid()`) — it did not restrict WHICH
--    columns changed. A client holding their own session could PATCH the row
--    directly via PostgREST while status='quoted' and set
--    `quoted_amount_cents` to any value, or jump `status` straight to a later
--    state, bypassing the app's TRANSITIONS state machine entirely.
--    `createInvoiceForWorkOrder` (lib/actions/invoices.ts) trusts the stored
--    `quoted_amount_cents` when issuing the Stripe invoice, so this was a
--    real financial-tampering vector.
--
--    Fix: acceptWorkOrderQuote (lib/actions/work-orders.ts) now performs its
--    write via the service-role admin client instead of the cookie-bound
--    client — matching the pattern already used by quoteWorkOrder and
--    updateWorkOrderStatus, both of which enforce the transition in code and
--    never relied on a client-writable RLS policy. With no client UPDATE
--    policy remaining, a direct PostgREST PATCH is rejected outright; the
--    only path to accept a quote is the server action, which re-validates
--    ownership + status='quoted' + quoted_amount_cents>0 before writing.
-- -----------------------------------------------------------------------------
drop policy if exists "wo_update_accept_quote" on public.work_orders;

-- -----------------------------------------------------------------------------
-- 2. leads / bookings: drop the anon INSERT policies.
--
--    Both `leads_insert_anon` and `bookings_insert_anon` (20260521000000) were
--    `for insert with check (true)` with no `to authenticated` restriction —
--    anyone holding the public anon key (NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY,
--    necessarily client-exposed) could insert unlimited rows directly via
--    PostgREST, skipping /api/lead's Upstash rate limit and the processLead
--    fan-out (Apollo/Customer.io/Resend) entirely.
--
--    Confirmed via grep that every INSERT into these tables in app code goes
--    through createAdminClient() (service role, bypasses RLS): leads via
--    lib/leads.ts:53, bookings via app/api/webhooks/calendly/route.ts:85.
--    No code path relies on the anon policy, so dropping it is a pure
--    tightening with zero functional impact.
-- -----------------------------------------------------------------------------
drop policy if exists "leads_insert_anon" on public.leads;
drop policy if exists "bookings_insert_anon" on public.bookings;
