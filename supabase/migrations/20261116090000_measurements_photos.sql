-- =============================================================================
-- RECOMP · Migration 12 · Body measurements & progress photos (Phase 7)
-- -----------------------------------------------------------------------------
-- body_measurements, progress_photos and the private `progress-photos` bucket
-- already exist (migrations 1–3). This only adds:
-- 1. body_measurements: weight and body fat are required for new / edited rows
--    (older rows are not re-checked); the measurement date can't be in the
--    future (Asia/Jakarta). week_number = the program check-in it counts for,
--    recorded_on = the actual date (may be a few days later).
-- 2. progress_photos.taken_on: the date the photo was taken (shown in the app),
--    separate from uploaded_at; never in the future.
--
-- Storage policies are unchanged (owner folder only, private bucket).
-- Run after migrations 1–11. Not re-runnable as a whole.
-- =============================================================================

begin;

-- 1. Measurements -------------------------------------------------------------
alter table public.body_measurements
  add constraint body_measurements_core_required
    check (weight_kg is not null and body_fat_pct is not null) not valid;

comment on column public.body_measurements.week_number is
  'Program week this check-in counts for (official: 1, 4, 8, 12). Never shifts the program.';
comment on column public.body_measurements.recorded_on is
  'Actual measurement date (may be later than the scheduled week).';

create function public.body_measurements_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recorded_on > public.recomp_today() then
    raise exception 'measurement_in_future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger body_measurements_validate
  before insert or update on public.body_measurements
  for each row execute function public.body_measurements_validate();

-- 2. Photos -------------------------------------------------------------------
alter table public.progress_photos add column taken_on date;
update public.progress_photos set taken_on = (uploaded_at at time zone 'Asia/Jakarta')::date where taken_on is null;
alter table public.progress_photos
  alter column taken_on set not null,
  alter column taken_on set default public.recomp_today();

comment on column public.progress_photos.taken_on is 'Date the photo was taken (Asia/Jakarta).';

create function public.progress_photos_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.taken_on > public.recomp_today() then
    raise exception 'photo_in_future' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger progress_photos_validate
  before insert or update on public.progress_photos
  for each row execute function public.progress_photos_validate();

commit;
