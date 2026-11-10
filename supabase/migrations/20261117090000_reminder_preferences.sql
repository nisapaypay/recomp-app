-- =============================================================================
-- RECOMP · Migration 13 · Reminder preferences (Phase 8)
-- -----------------------------------------------------------------------------
-- reminder_settings already exists (1:1 with the user, created by the auth
-- trigger; RLS: select / update own). This adds what the reminder settings
-- page needs:
-- 1. measurement_reminder_time (default 08:00) — separate from the workout time.
-- 2. reminder_days: ISO weekdays (1 = Monday … 7 = Sunday) on which reminders
--    may fire; default every day.
-- 3. Defaults: workout reminder 08:00, timezone Asia/Jakarta (the app saves
--    the browser's timezone when the user saves the settings).
--    Rows never edited by the user get the new defaults.
--
-- No server-side sending: reminders are shown by the open app (in-app banner +
-- best-effort browser notification). Run after migrations 1–12.
-- =============================================================================

begin;

alter table public.reminder_settings
  add column measurement_reminder_time time not null default '08:00',
  add column reminder_days smallint[] not null default '{1,2,3,4,5,6,7}',
  add constraint reminder_days_valid check (
    cardinality(reminder_days) between 1 and 7
    and reminder_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  );

alter table public.reminder_settings
  alter column workout_reminder_time set default '08:00',
  alter column timezone set default 'Asia/Jakarta';

-- Untouched rows (never saved by the user) follow the new defaults.
update public.reminder_settings
set workout_reminder_time = '08:00', timezone = 'Asia/Jakarta'
where updated_at = created_at and workout_reminder_time = '07:00' and timezone = 'UTC';

comment on column public.reminder_settings.reminder_days is 'ISO weekdays (1 = Mon … 7 = Sun) on which reminders may be shown.';
comment on column public.reminder_settings.timezone is 'IANA timezone used for reminder times (saved from the browser).';

commit;
