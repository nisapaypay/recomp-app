-- =============================================================================
-- RECOMP · Migration 11 · Walking tracker (Phase 6)
-- -----------------------------------------------------------------------------
-- walking_activities already exists (migration 1). This adds:
-- 1. scheduled_date: the program walk (Tuesday / Saturday) a log counts for.
--    NULL = an additional walk outside the schedule. activity_date stays the
--    date the walk was actually done (performed date).
-- 2. At most one log per scheduled walk (no double counting).
-- 3. New / edited rows: distance required, steps > 0 when given.
-- 4. Trigger validation: no future dates (Asia/Jakarta); a scheduled walk must
--    be a walking day of one of the user's programs; it may be done in its own
--    program week or later (catch-up), never before that week starts.
-- 5. Backfill: existing logs on a programmed walking day become that day's
--    scheduled walk (first one per day; others stay additional).
--
-- Run after migrations 1–10. Not re-runnable as a whole.
-- =============================================================================

begin;

-- 1. Column -------------------------------------------------------------------
alter table public.walking_activities add column scheduled_date date;

comment on column public.walking_activities.activity_date is
  'Date the walk was actually done (performed date, Asia/Jakarta).';
comment on column public.walking_activities.scheduled_date is
  'Program walking day (Tue/Sat) this log counts for; NULL = additional walk. Never shifts the schedule.';

alter table public.walking_activities
  add constraint walking_scheduled_is_walking_weekday
    check (scheduled_date is null or extract(isodow from scheduled_date) in (2, 6)),
  add constraint walking_not_before_scheduled_week
    check (scheduled_date is null
           or activity_date >= scheduled_date - (extract(isodow from scheduled_date)::int - 1));

-- 3. Rules for new and edited rows (existing rows are not re-checked).
alter table public.walking_activities
  add constraint walking_distance_required check (distance_km is not null) not valid,
  add constraint walking_steps_positive check (steps is null or steps > 0) not valid;

-- 2. One log per scheduled walk ---------------------------------------------
-- 5. Backfill first (only rows that fit the rules, first log per day).
update public.walking_activities w
set scheduled_date = w.activity_date
from (
  select distinct on (wa.user_id, wa.activity_date) wa.id
  from public.walking_activities wa
  join public.user_programs p
    on p.user_id = wa.user_id and wa.activity_date between p.start_date and p.end_date
  where extract(isodow from wa.activity_date) in (2, 6)
  order by wa.user_id, wa.activity_date, wa.created_at
) first_log
where w.id = first_log.id;

create unique index walking_one_log_per_scheduled_walk_idx
  on public.walking_activities (user_id, scheduled_date) where scheduled_date is not null;

-- 4. Validation trigger -------------------------------------------------------
create function public.walking_activities_validate()
returns trigger
language plpgsql
security invoker            -- program lookup runs with the caller's RLS
set search_path = ''
as $$
begin
  if new.activity_date > public.recomp_today() then
    raise exception 'walk_in_future' using errcode = '23514';
  end if;
  if new.scheduled_date is not null and not exists (
    select 1
    from public.user_programs p
    join public.program_days d
      on d.week_number = (new.scheduled_date - p.start_date) / 7 + 1
     and d.day_of_week = extract(isodow from new.scheduled_date)::int
    where p.user_id = new.user_id
      and new.scheduled_date between p.start_date and p.end_date
      and d.activity_type = 'walking'
  ) then
    raise exception 'not_a_program_walk' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger walking_activities_validate
  before insert or update on public.walking_activities
  for each row execute function public.walking_activities_validate();

commit;
