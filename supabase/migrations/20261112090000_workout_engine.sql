-- =============================================================================
-- RECOMP · Migration 8 · Workout engine (Phase 4)
-- -----------------------------------------------------------------------------
-- 1. "Active" session = in_progress OR interrupted. At most one per user
--    (replaces the in_progress-only index), so an interrupted workout still
--    blocks a second one until the user chooses Continue or Start Over.
-- 2. Checkpoint columns for pause bookkeeping on workout_session_state.
-- 3. public.recomp_today(): today's date in Asia/Jakarta (single definition).
-- 4. public.start_workout_session(program_id): atomic, server-validated start.
--    Returns the existing active session instead of creating a duplicate.
-- Run after migrations 1–7. Not re-runnable as a whole (creates objects).
-- =============================================================================

begin;

-- 1. One active session per user ------------------------------------------------
drop index if exists public.workout_sessions_one_in_progress_idx;

create unique index workout_sessions_one_active_idx
  on public.workout_sessions (user_id)
  where status in ('in_progress', 'interrupted');

-- 2. Pause bookkeeping ------------------------------------------------------------
alter table public.workout_session_state
  add column paused_ms_total integer not null default 0 check (paused_ms_total >= 0),
  add column paused_at timestamptz;

comment on column public.workout_session_state.phase_started_at is
  'Wall-clock start of the current phase (work phase: when the side/set started).';
comment on column public.workout_session_state.phase_duration_ms is
  'Length of a timed phase (prepare / rest / hold). Ends at phase_started_at + duration. NULL for rep work.';
comment on column public.workout_session_state.remaining_ms is
  'Remaining time of a timed phase while paused.';
comment on column public.workout_session_state.tempo_override is
  'Per-session tempo adjustments: {"<order_index>": [eccentric, pause, concentric]}.';

-- 3. Program "today" ---------------------------------------------------------------
create or replace function public.recomp_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;

comment on function public.recomp_today() is 'Today in the program timezone (Asia/Jakarta).';

-- 4. Atomic start -------------------------------------------------------------------
create or replace function public.start_workout_session(p_program_id uuid)
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

  -- Existing active session → return it (no duplicates; caller decides what to do).
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
  if v_today < v_start or v_today > v_end then
    raise exception 'outside_program';
  end if;

  v_week := (v_today - v_start) / 7 + 1;
  v_dow  := extract(isodow from v_today)::int;

  select d.activity_type into v_activity
  from public.program_days d
  where d.week_number = v_week and d.day_of_week = v_dow;
  if v_activity is null or v_activity not in ('lower_body', 'upper_body_core', 'full_body_core') then
    raise exception 'not_a_workout_day';
  end if;

  if exists (
    select 1 from public.workout_sessions s
    where s.user_id = v_uid and s.workout_date = v_today
      and s.activity_type = v_activity and s.status = 'completed'
  ) then
    raise exception 'already_completed';
  end if;

  begin
    insert into public.workout_sessions (user_id, program_id, workout_date, week_number, day_of_week, activity_type)
    values (v_uid, p_program_id, v_today, v_week, v_dow, v_activity)
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

  -- Snapshot the effective prescription (program overrides → library defaults).
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

revoke all on function public.start_workout_session(uuid) from public, anon;
grant execute on function public.start_workout_session(uuid) to authenticated;
grant execute on function public.recomp_today() to authenticated;

commit;
