-- =============================================================================
-- RECOMP · Migration 10 · Adaptive progression (Phase 5)
-- -----------------------------------------------------------------------------
-- 1. exercise_library progression metadata (movement type + safe step sizes),
--    so rules come from data, not from exercise names in the frontend.
-- 2. One adjustment per feedback / per source session (no double processing).
-- 3. Prescription snapshots of a workout are immutable once written
--    (historical workouts never change).
-- 4. save_workout_feedback(): atomic feedback + adjustment write with
--    server-side validation (owner, completed workout, bounds, direction,
--    pain, edit window).
-- 5. start_workout_session(): applies the user's adjustments when it
--    snapshots a new workout (same signature as migration 9).
--
-- Run after migrations 1–9. Not re-runnable as a whole.
-- =============================================================================

begin;

-- 1. Progression metadata ------------------------------------------------------
alter table public.exercise_library
  add column movement_type text not null default 'compound'
    check (movement_type in ('compound', 'isolation', 'core', 'mobility')),
  add column progression_step smallint not null default 2
    check (progression_step between 0 and 10),          -- reps (per side) or seconds per change; 0 = never adjusted
  add column progression_headroom smallint not null default 4
    check (progression_headroom between 0 and 30),      -- max above the program's base target
  add column regression_room smallint not null default 4
    check (regression_room between 0 and 30),           -- max below the program's base target
  add column max_extra_sets smallint not null default 1
    check (max_extra_sets between 0 and 1);             -- sets the user may add on top of the program

comment on column public.exercise_library.movement_type is
  'compound | isolation | core | mobility — drives adaptive progression rules.';
comment on column public.exercise_library.progression_step is
  'Size of one adaptive change: reps (per side for unilateral) or seconds for timed holds. 0 = never adjusted.';

-- Values: compound bilateral ±2 (room +4/−4); unilateral ±1 per side (+2 or +3);
-- isolation bilateral ±2 (+5); core unilateral ±1 (+2); plank ±5 s (+15 s / −10 s, no extra sets);
-- arm circles are a warm-up and never adjusted.
update public.exercise_library e set
  movement_type        = v.movement_type,
  progression_step     = v.step,
  progression_headroom = v.headroom,
  regression_room      = v.room,
  max_extra_sets       = v.extra
from (values
  ('bodyweight-squat',           'compound',  2, 4, 4, 1),
  ('sumo-squat',                 'compound',  2, 4, 4, 1),
  ('goblet-squat',               'compound',  2, 4, 4, 1),
  ('dumbbell-sumo-squat',        'compound',  2, 4, 4, 1),
  ('dumbbell-romanian-deadlift', 'compound',  2, 4, 4, 1),
  ('wall-push-up',               'compound',  2, 4, 4, 1),
  ('shoulder-press',             'compound',  2, 4, 4, 1),
  ('bent-over-row',              'compound',  2, 4, 4, 1),
  ('reverse-lunge',              'compound',  1, 2, 3, 1),
  ('dumbbell-reverse-lunge',     'compound',  1, 2, 3, 1),
  ('one-arm-dumbbell-row',       'compound',  1, 2, 3, 1),
  ('glute-bridge',               'isolation', 2, 5, 4, 1),
  ('dumbbell-glute-bridge',      'isolation', 2, 5, 4, 1),
  ('calf-raise',                 'isolation', 2, 5, 4, 1),
  ('dumbbell-calf-raise',        'isolation', 2, 5, 4, 1),
  ('prone-w-raise',              'isolation', 2, 4, 4, 1),
  ('bicep-curl',                 'isolation', 2, 4, 4, 1),
  ('lateral-raise',              'isolation', 2, 4, 4, 1),
  ('overhead-triceps-extension', 'isolation', 2, 4, 4, 1),
  ('donkey-kick',                'isolation', 1, 3, 4, 1),
  ('side-lying-leg-raise',       'isolation', 1, 3, 4, 1),
  ('bird-dog',                   'core',      1, 2, 3, 1),
  ('dead-bug',                   'core',      1, 2, 3, 1),
  ('standing-knee-raise',        'core',      1, 3, 4, 1),
  ('plank',                      'core',      5, 15, 10, 0),
  ('arm-circles',                'mobility',  0, 0, 0, 0)
) as v(id, movement_type, step, headroom, room, extra)
where e.id = v.id;

do $$
begin
  if (select count(*) from public.exercise_library where movement_type is null) > 0
     or (select count(*) from public.exercise_library) <> 26 then
    raise exception 'progression metadata incomplete';
  end if;
end;
$$;

-- 2. No double processing -------------------------------------------------------
create unique index adaptive_adjustments_one_per_feedback_idx
  on public.adaptive_adjustments (feedback_id) where feedback_id is not null;
create unique index adaptive_adjustments_one_per_session_idx
  on public.adaptive_adjustments (source_session_id) where source_session_id is not null;

-- 3. Immutable prescription snapshots ----------------------------------------
create function public.workout_exercises_prescription_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.exercise_id         is distinct from old.exercise_id
     or new.order_index       is distinct from old.order_index
     or new.measure_type      is distinct from old.measure_type
     or new.side_mode         is distinct from old.side_mode
     or new.prescribed_sets   is distinct from old.prescribed_sets
     or new.prescribed_target is distinct from old.prescribed_target
     or new.tempo_eccentric_s is distinct from old.tempo_eccentric_s
     or new.tempo_pause_s     is distinct from old.tempo_pause_s
     or new.tempo_concentric_s is distinct from old.tempo_concentric_s
     or new.rest_seconds      is distinct from old.rest_seconds then
    -- (adjustment_id is left out on purpose: its FK uses ON DELETE SET NULL.)
    raise exception 'prescription_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger workout_exercises_prescription_immutable
  before update on public.workout_exercises
  for each row execute function public.workout_exercises_prescription_immutable();

-- 4. Feedback + adjustment, atomically ----------------------------------------
-- p_adjustment: null (no change) or
--   {"exercise_id", "change_type", "previous_sets", "previous_target",
--    "new_sets", "new_target", "reason"}
-- The app computes WHICH change to make (src/lib/progression/adaptive.ts);
-- this function re-validates every safety rule before writing.
create function public.save_workout_feedback(
  p_session_id uuid,
  p_difficulty text,
  p_pain       boolean,
  p_notes      text,
  p_adjustment jsonb
)
returns table (out_feedback_id uuid, out_adjustment_id uuid)
language plpgsql
security invoker            -- RLS applies to every statement
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_session   record;
  v_feedback  uuid;
  v_adj       uuid;
  v_ex        record;
  v_type      text;
  v_prev_sets int;  v_prev_target int;
  v_new_sets  int;  v_new_target int;
  v_floor     int;  v_ceiling int;  v_max_sets int;
  v_reason    text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_difficulty not in ('too_easy', 'just_right', 'too_hard') then
    raise exception 'invalid_difficulty';
  end if;

  -- Lock the session: concurrent submits for the same workout run one at a time.
  select s.id, s.status, s.activity_type, s.completed_at, s.program_id
    into v_session
  from public.workout_sessions s
  where s.id = p_session_id and s.user_id = v_uid
  for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  if v_session.status <> 'completed' then
    raise exception 'not_completed';
  end if;

  -- Editable only until the next workout of the same type has been started.
  select f.id into v_feedback from public.workout_feedback f where f.session_id = p_session_id;
  if v_feedback is not null and exists (
    select 1 from public.workout_sessions s2
    where s2.user_id = v_uid and s2.id <> p_session_id
      and s2.activity_type = v_session.activity_type
      and s2.created_at >= v_session.completed_at
  ) then
    raise exception 'feedback_locked';
  end if;

  -- Replace (never add to) this workout's previous adjustment.
  delete from public.adaptive_adjustments a
  where a.user_id = v_uid and (a.source_session_id = p_session_id or (v_feedback is not null and a.feedback_id = v_feedback));

  insert into public.workout_feedback (user_id, session_id, difficulty, pain_reported, notes)
  values (v_uid, p_session_id, p_difficulty, coalesce(p_pain, false), nullif(btrim(p_notes), ''))
  on conflict (session_id) do update
    set difficulty = excluded.difficulty,
        pain_reported = excluded.pain_reported,
        notes = excluded.notes
  returning id into v_feedback;

  if p_adjustment is null or jsonb_typeof(p_adjustment) = 'null' then
    return query select v_feedback, null::uuid;
    return;
  end if;

  if p_difficulty = 'just_right' then
    raise exception 'invalid_adjustment';
  end if;

  v_type        := p_adjustment ->> 'change_type';
  v_prev_sets   := (p_adjustment ->> 'previous_sets')::int;
  v_prev_target := (p_adjustment ->> 'previous_target')::int;
  v_new_sets    := (p_adjustment ->> 'new_sets')::int;
  v_new_target  := (p_adjustment ->> 'new_target')::int;
  v_reason      := btrim(p_adjustment ->> 'reason');

  -- The exercise must be in THIS workout, actually performed, and unchanged.
  select we.prescribed_sets, we.prescribed_target, we.status, we.measure_type,
         pe.sets as base_sets, pe.target_min, pe.target_max,
         e.progression_step, e.progression_headroom, e.regression_room, e.max_extra_sets
    into v_ex
  from public.workout_exercises we
  join public.program_exercises pe on pe.id = we.program_exercise_id
  join public.exercise_library e on e.id = we.exercise_id
  where we.session_id = p_session_id and we.user_id = v_uid
    and we.exercise_id = p_adjustment ->> 'exercise_id'
  limit 1;
  if not found or v_ex.status in ('skipped', 'pending') then
    raise exception 'exercise_not_performed';
  end if;
  if v_ex.progression_step = 0 then
    raise exception 'invalid_adjustment';
  end if;
  if v_prev_sets is distinct from v_ex.prescribed_sets or v_prev_target is distinct from v_ex.prescribed_target then
    raise exception 'invalid_adjustment';
  end if;

  -- Direction must match the feedback; never progress through pain or an unfinished exercise.
  if p_difficulty = 'too_easy' then
    if coalesce(p_pain, false) then raise exception 'progression_blocked_pain'; end if;
    if v_type not in ('increase_target', 'increase_sets') then raise exception 'invalid_adjustment'; end if;
    if v_ex.status <> 'completed' then raise exception 'exercise_not_completed'; end if;
  elsif v_type not in ('decrease_target', 'decrease_sets') then
    raise exception 'invalid_adjustment';
  end if;

  -- Bounds (same formula as the snapshot in start_workout_session).
  v_floor    := least(v_ex.target_min, greatest(v_ex.target_min - v_ex.regression_room,
                                                case when v_ex.measure_type = 'seconds' then 10 else 4 end));
  v_ceiling  := greatest(v_ex.target_max, v_ex.target_min + v_ex.progression_headroom);
  v_max_sets := least(v_ex.base_sets + v_ex.max_extra_sets, 4);

  if v_type in ('increase_target', 'decrease_target') then
    if v_new_sets <> v_prev_sets
       or abs(v_new_target - v_prev_target) > v_ex.progression_step
       or (v_type = 'increase_target' and (v_new_target <= v_prev_target or v_new_target > v_ceiling))
       or (v_type = 'decrease_target' and (v_new_target >= v_prev_target or v_new_target < v_floor)) then
      raise exception 'invalid_adjustment';
    end if;
  else
    if v_new_target <> v_prev_target
       or (v_type = 'increase_sets' and (v_new_sets <> v_prev_sets + 1 or v_new_sets > greatest(v_max_sets, 1)))
       or (v_type = 'decrease_sets' and (v_new_sets <> v_prev_sets - 1 or v_new_sets < 1)) then
      raise exception 'invalid_adjustment';
    end if;
  end if;
  if v_reason is null or length(v_reason) = 0 then
    raise exception 'invalid_adjustment';
  end if;

  insert into public.adaptive_adjustments (
    user_id, exercise_id, activity_type, feedback_id, source_session_id,
    previous_sets, previous_target, new_sets, new_target, change_type, reason, effective_from
  ) values (
    v_uid, p_adjustment ->> 'exercise_id', v_session.activity_type, v_feedback, p_session_id,
    v_prev_sets, v_prev_target, v_new_sets, v_new_target, v_type, left(v_reason, 500), public.recomp_today()
  )
  returning id into v_adj;

  return query select v_feedback, v_adj;
end;
$$;

revoke all on function public.save_workout_feedback(uuid, text, boolean, text, jsonb) from public, anon;
grant execute on function public.save_workout_feedback(uuid, text, boolean, text, jsonb) to authenticated;

-- 5. Start function: snapshot applies the user's adjustments -------------------
create or replace function public.start_workout_session(p_program_id uuid, p_scheduled_date date)
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

  -- Snapshot the SCHEDULED week/day prescription (program overrides → library
  -- defaults), plus the user's accumulated adjustments for this exercise and
  -- workout type, clamped to each exercise's safe range.
  insert into public.workout_exercises (
    session_id, user_id, program_exercise_id, exercise_id, adjustment_id, order_index, exercise_name_snapshot,
    measure_type, side_mode, prescribed_sets, prescribed_target,
    tempo_eccentric_s, tempo_pause_s, tempo_concentric_s, rest_seconds
  )
  select
    v_session, v_uid, pe.id, e.id, adj.last_id, pe.order_index, e.name,
    e.measure_type, e.side_mode,
    least(greatest(pe.sets + coalesce(adj.sets_offset, 0), 1),
          greatest(least(pe.sets + e.max_extra_sets, 4), pe.sets)),
    least(greatest(pe.target_min + coalesce(adj.target_offset, 0),
                   least(pe.target_min, greatest(pe.target_min - e.regression_room,
                                                 case when e.measure_type = 'seconds' then 10 else 4 end))),
          greatest(pe.target_max, pe.target_min + e.progression_headroom)),
    coalesce(pe.tempo_eccentric_s, e.tempo_eccentric_s),
    coalesce(pe.tempo_pause_s, e.tempo_pause_s),
    coalesce(pe.tempo_concentric_s, e.tempo_concentric_s),
    coalesce(pe.rest_seconds, e.default_rest_seconds)
  from public.program_exercises pe
  join public.exercise_library e on e.id = pe.exercise_id
  left join lateral (
    select sum(a.new_target - a.previous_target)::int as target_offset,
           sum(a.new_sets - a.previous_sets)::int     as sets_offset,
           (array_agg(a.id order by a.created_at desc))[1] as last_id
    from public.adaptive_adjustments a
    where a.user_id = v_uid and a.exercise_id = pe.exercise_id
      and a.activity_type = v_activity and a.effective_from <= v_today
      and e.progression_step > 0
  ) adj on true
  where pe.week_number = v_week and pe.day_of_week = v_dow
  order by pe.order_index;

  insert into public.workout_session_state (session_id, user_id) values (v_session, v_uid);

  return query select v_session, true;
end;
$$;

revoke all on function public.start_workout_session(uuid, date) from public, anon;
grant execute on function public.start_workout_session(uuid, date) to authenticated;

commit;
