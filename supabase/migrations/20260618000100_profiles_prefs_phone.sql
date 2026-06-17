-- =============================================================================
-- dobeu.net v3 — profiles phone + notification prefs (2026-06-18)
-- -----------------------------------------------------------------------------
-- Adds the two columns the portal Settings surface now persists:
--   - profiles.phone        text          (nullable; contact number)
--   - profiles.notify_email boolean        (not null default true; email opt-in)
--
-- `updateProfile` (lib/actions/profile.ts) previously dropped `phone` on the
-- floor (returned it as `unstored_phone`) because no column existed. This
-- migration backs that field and adds an email-notification preference.
--
-- Idempotent: safe to re-run during cutover prep.
--
-- -----------------------------------------------------------------------------
-- CENTRAL `pnpm db:types` ACTION REQUIRED (orchestrator reconciles types):
-- Add to public.profiles Row in lib/database.types.ts:
--     phone: string | null;
--     notify_email: boolean;
-- (Insert/Update are Partial<Row> so no extra edits needed there.)
-- =============================================================================

alter table public.profiles
  add column if not exists phone text;

alter table public.profiles
  add column if not exists notify_email boolean not null default true;

comment on column public.profiles.phone is
  'Contact phone number; user-editable from portal Settings. Nullable.';

comment on column public.profiles.notify_email is
  'Email-notification opt-in. Default true; user-editable from portal Settings.';
