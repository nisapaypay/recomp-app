-- =============================================================================
-- RECOMP · Migration 9 · Catch-up workouts: scheduled date vs performed time
-- -----------------------------------------------------------------------------
-- The program calendar never shifts, but a workout may now be done on a later
-- day (catch-up) as long as it isn't completed yet.
--
-- 1. workout_sessions.workout_date → scheduled_date (rename only; the column
--    always held the program day the workout belongs to).
-- 2. performed_at: when the user actually began the workout (NULL until then).
-- 3. At most ONE completed session per user + scheduled date + activity
--    (abandoned / stopped attempts stay as history).
-- 4. start_workout_session(program_id, scheduled_date) replaces the
--    today-only version: past and today allowed, future refused.
--
-- Run after migrations 1–8. Not re-runnable as a whole.
-- =============================================================================

begin;

-- 1. Rename ------------------------------------------------------------------
alter table public.workout_sessions rename column workout_date to scheduled_date;
alter index public.workout_sessions_user_date_idx rename to workout_sessions_user_scheduled_idx;

comment on column public.workout_sessions.scheduled_date is
  'Program day this workout belongs to (fixed calendar). Never changes with catch-ups.';

-- 2. Performed time ------------------------------------------------------------
alter table public.workout_sessions add column performed_at timestamptz;

comment on column public.workout_sessions.performed_at is
  'When the user actually began the workout (Begin pressed). NULL if never begun.';

-- Existing finished sessions began at started_at (Phase 4 set it on Begin).
update public.workout_sessions
set performed_at = started_at
where performed_at is null and status in ('completed', 'stopped');

alter table public.workout_sessions
  add constraint workout_sessions_completed_was_performed
  check (status <> 'completed' or performed_at is not null);

-- 3. No duplicate completions ------------------------------------------------
create unique index workout_sessions_one_completed_per_day_idx
  on public.workout_sessions (user_id, scheduled_date, activity_type)
  where status = 'completed';

-- 4. Start function -------------------------------------------------------------
drop function if exists public.start_workout_session(uuid);

create function public.start_workout_session(p_program_id uuid, p_scheduled_date date)
returns table (out_session_id uuid, out_created boolean)
language plpgsql
security invoker            -- runs as the caller: RLS applies to every statement
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_today    date := public.recomp_today();
  v_start    date;
  v_end      date;
  v_week     int;
  v_dow      int;
  v_activity text;
  v_session  uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_scheduled_date is null then
    raise exception 'invalid_date';
  end if;

  -- One active session per user: return it instead of creating another.
  select s.id into v_session
  from public.workout_sessions s
  where s.user_id = v_uid and s.status in ('in_progress', 'interrupted')
  limit 1;
  if found then
    return query select v_session, false;
    return;
  end if;

  select p.start_date, p.end_date into v_start, v_end
  from public.user_programs p
  where p.id = p_program_id and p.user_id = v_uid and p.status = 'active';
  if not found then
    raise exception 'program_not_active';
  end if;
  if p_scheduled_date < v_start or p_scheduled_date > v_end then
    raise exception 'outside_program';
  end if;
  if p_scheduled_date > v_today then
    raise exception 'not_yet_scheduled';
  end if;

  v_week := (p_scheduled_date - v_start) / 7 + 1;
  v_dow  := extract(isodow from p_scheduled_date)::int;

  select d.activity_type into v_activity
  from public.program_days d
  where d.week_number = v_week and d.day_of_week = v_dow;
  if v_activity is null or v_activity not in ('lower_body', 'upper_body_core', 'full_body_core') then
    raise exception 'not_a_workout_day';
  end if;

  if exists (
    select 1 from public.workout_sessions s
    where s.user_id = v_uid and s.scheduled_date = p_scheduled_date
      and s.activity_type = v_activity and s.status = 'completed'
  ) then
    raise exception 'already_completed';
  end if;

  begin
    insert into public.workout_sessions (user_id, program_id, scheduled_date, week_number, day_of_week, activity_type)
    values (v_uid, p_program_id, p_scheduled_date, v_week, v_dow, v_activity)
    returning id into v_session;
  exception when unique_violation then
    -- Lost a race with a concurrent start (double click / second device).
    select s.id into v_session
    from public.workout_sessions s
    where s.user_id = v_uid and s.status in ('in_progress', 'interrupted')
    limit 1;
    return query select v_session, false;
    return;
  end;

  -- Snapshot the prescription of the SCHEDULED week/day (program overrides → library defaults).
  insert into public.workout_exercises (
    session_id, user_id, program_exercise_id, exercise_id, order_index, exercise_name_snapshot,
    measure_type, side_mode, prescribed_sets, prescribed_target,
    tempo_eccentric_s, tempo_pause_s, tempo_concentric_s, rest_seconds
  )
  select
    v_session, v_uid, pe.id, e.id, pe.order_index, e.name,
    e.measure_type, e.side_mode, pe.sets, pe.target_min,
    coalesce(pe.tempo_eccentric_s, e.tempo_eccentric_s),
    coalesce(pe.tempo_pause_s, e.tempo_pause_s),
    coalesce(pe.tempo_concentric_s, e.tempo_concentric_s),
    coalesce(pe.rest_seconds, e.default_rest_seconds)
  from public.program_exercises pe
  join public.exercise_library e on e.id = pe.exercise_id
  where pe.week_number = v_week and pe.day_of_week = v_dow
  order by pe.order_index;

  insert into public.workout_session_state (session_id, user_id) values (v_session, v_uid);

  return query select v_session, true;
end;
$$;

revoke all on function public.start_workout_session(uuid, date) from public, anon;
grant execute on function public.start_workout_session(uuid, date) to authenticated;

commit;
