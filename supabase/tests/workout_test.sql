-- =============================================================================
-- RECOMP · Workout session test (Phase 4 + catch-up rules)
-- -----------------------------------------------------------------------------
-- Run AFTER all migrations (1–9), in Supabase → SQL Editor. Everything (test
-- users, data, and a temporarily fixed "today") is ROLLED BACK at the end.
-- Success = a row "ALL WORKOUT TESTS PASSED (changes rolled back)".
--
-- Program starts Monday 9 Nov 2026. Week 2: Mon 16 Lower Body, Tue 17 Walking,
-- Wed 18 Upper Body & Core, Thu 19 Recovery, Fri 20 Full Body & Core.
-- "Today" is frozen at Tuesday 17 Nov (walking day).
-- =============================================================================

begin;

create or replace function public.recomp_today() returns date
language sql stable set search_path = '' as $$ select date '2026-11-17' $$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'workout-test-a@example.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'workout-test-b@example.invalid');

insert into public.user_programs (id, user_id, start_date) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', date '2026-11-09'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', date '2026-11-09');

-- ----------------------------------------------------------------------------- A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

do $$
declare
  a   constant uuid := '00000000-0000-4000-8000-00000000000a';
  p   constant uuid := '00000000-0000-4000-8000-0000000000a1';
  mon uuid; fri uuid; again uuid; s uuid; created boolean; n int; ex uuid;

begin
  -- Refusals (no active session yet) --------------------------------------
  begin
    perform public.start_workout_session(p, date '2026-11-18');           -- Wednesday: future
    raise exception 'WORKOUT TEST FAILED: started a future workout';
  exception when raise_exception then
    if sqlerrm <> 'not_yet_scheduled' then raise; end if;
  end;
  begin
    perform public.start_workout_session(p, date '2026-11-17');           -- today, but walking
    raise exception 'WORKOUT TEST FAILED: started a walking day as a workout';
  exception when raise_exception then
    if sqlerrm <> 'not_a_workout_day' then raise; end if;
  end;
  begin
    perform public.start_workout_session(p, date '2026-11-12');           -- Thursday recovery
    raise exception 'WORKOUT TEST FAILED: started a recovery day';
  exception when raise_exception then
    if sqlerrm <> 'not_a_workout_day' then raise; end if;
  end;
  begin
    perform public.start_workout_session(p, date '2026-11-02');           -- before the program
    raise exception 'WORKOUT TEST FAILED: started a workout before the program';
  exception when raise_exception then
    if sqlerrm <> 'outside_program' then raise; end if;
  end;

  -- Catch-up: Monday's Lower Body on Tuesday --------------------------------
  select out_session_id, out_created into mon, created from public.start_workout_session(p, date '2026-11-16');
  if not created then raise exception 'WORKOUT TEST FAILED: catch-up start did not create a session'; end if;
  if not exists (select 1 from public.workout_sessions
                 where id = mon and scheduled_date = date '2026-11-16' and week_number = 2
                   and day_of_week = 1 and activity_type = 'lower_body' and performed_at is null) then
    raise exception 'WORKOUT TEST FAILED: catch-up session not stored with its scheduled date';
  end if;
  if not exists (select 1 from public.workout_exercises
                 where session_id = mon and order_index = 1 and exercise_id = 'goblet-squat'
                   and prescribed_sets = 2 and prescribed_target = 12 and rest_seconds = 90) then
    raise exception 'WORKOUT TEST FAILED: week-2 Monday snapshot wrong';
  end if;

  -- Duplicate prevention: same day again → same session; another day → still the one active session.
  select out_session_id, out_created into again, created from public.start_workout_session(p, date '2026-11-16');
  if created or again <> mon then raise exception 'WORKOUT TEST FAILED: duplicate session for the same day'; end if;
  select out_session_id, out_created into again, created from public.start_workout_session(p, date '2026-11-13');
  if created or again <> mon then raise exception 'WORKOUT TEST FAILED: second active session for another day'; end if;

  -- Interrupted still counts as active.
  update public.workout_sessions set status = 'interrupted' where id = mon;
  begin
    insert into public.workout_sessions (user_id, program_id, scheduled_date, week_number, day_of_week, activity_type)
    values (a, p, date '2026-11-13', 1, 5, 'full_body_core');
    raise exception 'WORKOUT TEST FAILED: second active session allowed';
  exception when unique_violation then null;
  end;
  update public.workout_sessions set status = 'in_progress' where id = mon;

  -- Sets: one row per set/side, idempotent.
  select id into ex from public.workout_exercises where session_id = mon and order_index = 3; -- DB reverse lunge
  insert into public.workout_sets (workout_exercise_id, user_id, set_number, side, target, achieved, status)
  values (ex, a, 1, 'left', 10, 10, 'completed'), (ex, a, 1, 'right', 10, 9, 'partial');
  begin
    insert into public.workout_sets (workout_exercise_id, user_id, set_number, side, target, achieved, status)
    values (ex, a, 1, 'left', 10, 10, 'completed');
    raise exception 'WORKOUT TEST FAILED: duplicate set row allowed';
  exception when unique_violation then null;
  end;

  -- Completed requires performed_at.
  begin
    update public.workout_sessions set status = 'completed', completed_at = now() where id = mon;
    raise exception 'WORKOUT TEST FAILED: completed without performed_at';
  exception when check_violation then null;
  end;

  -- Complete the catch-up: performed Tuesday, scheduled Monday.
  update public.workout_sessions
  set status = 'completed', performed_at = timestamptz '2026-11-17 01:30:00+00', completed_at = now(), duration_seconds = 1500
  where id = mon;

  -- Already completed → cannot start that scheduled day again …
  begin
    perform public.start_workout_session(p, date '2026-11-16');
    raise exception 'WORKOUT TEST FAILED: restarted a completed workout';
  exception when raise_exception then
    if sqlerrm <> 'already_completed' then raise; end if;
  end;
  -- … and the database refuses a second completed row even without the function.
  begin
    insert into public.workout_sessions (user_id, program_id, scheduled_date, week_number, day_of_week, activity_type,
                                         status, performed_at, completed_at)
    values (a, p, date '2026-11-16', 2, 1, 'lower_body', 'completed', now(), now());
    raise exception 'WORKOUT TEST FAILED: duplicate completed workout allowed';
  exception when unique_violation then null;
  end;

  -- Older catch-up (last week's Friday) uses ITS week's prescription (plank 15–20 s → 15).
  select out_session_id, out_created into fri, created from public.start_workout_session(p, date '2026-11-13');
  if not created then raise exception 'WORKOUT TEST FAILED: older catch-up not allowed'; end if;
  if not exists (select 1 from public.workout_exercises
                 where session_id = fri and exercise_id = 'plank' and prescribed_target = 15) then
    raise exception 'WORKOUT TEST FAILED: catch-up did not use the scheduled week prescription';
  end if;

  -- Start Over: abandoned attempt is kept, a new one can start for the same day.
  update public.workout_sessions set status = 'abandoned' where id = fri;
  select out_session_id, out_created into s, created from public.start_workout_session(p, date '2026-11-13');
  if not created or s = fri then raise exception 'WORKOUT TEST FAILED: start over did not create a new session'; end if;
  if not exists (select 1 from public.workout_sessions where id = fri and status = 'abandoned') then
    raise exception 'WORKOUT TEST FAILED: abandoned attempt was not kept';
  end if;
  -- A stopped attempt is not completed: the day can still be done later.
  update public.workout_sessions set status = 'stopped', performed_at = now(), duration_seconds = 60 where id = s;
  select out_session_id, out_created into again, created from public.start_workout_session(p, date '2026-11-13');
  if not created then raise exception 'WORKOUT TEST FAILED: stopped workout blocked a new attempt'; end if;
  update public.workout_sessions set status = 'abandoned' where id = again;

  -- Feedback: once per session.
  insert into public.workout_feedback (user_id, session_id, difficulty) values (a, mon, 'just_right');
  begin
    insert into public.workout_feedback (user_id, session_id, difficulty) values (a, mon, 'too_easy');
    raise exception 'WORKOUT TEST FAILED: second feedback row allowed';
  exception when unique_violation then null;
  end;

  -- Checkpoint update + pause bookkeeping columns.
  update public.workout_session_state
  set paused = true, remaining_ms = 4000, paused_ms_total = 1500, paused_at = now(), revision = revision + 1
  where session_id = mon;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'WORKOUT TEST FAILED: could not update own checkpoint'; end if;
end;
$$;

-- A: cannot start using someone else's program.
do $$
begin
  perform public.start_workout_session('00000000-0000-4000-8000-0000000000b1', date '2026-11-16');
  raise exception 'WORKOUT TEST FAILED: started a workout on B''s program';
exception when raise_exception then
  if sqlerrm <> 'program_not_active' then raise; end if;
end;
$$;

reset role;

-- Today = Wednesday 18 Nov (strength day): today's workout is allowed.
create or replace function public.recomp_today() returns date
language sql stable set search_path = '' as $$ select date '2026-11-18' $$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$
declare s uuid; created boolean;
begin
  select out_session_id, out_created into s, created
  from public.start_workout_session('00000000-0000-4000-8000-0000000000a1', date '2026-11-18');
  if not created then raise exception 'WORKOUT TEST FAILED: today''s workout not allowed'; end if;
end;
$$;

-- ----------------------------------------------------------------------------- B
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$
declare
  b constant uuid := '00000000-0000-4000-8000-00000000000b';
  n int;
begin
  -- B sees none of A's workout data.
  if (select count(*) from public.workout_sessions) <> 0
     or (select count(*) from public.workout_exercises) <> 0
     or (select count(*) from public.workout_sets) <> 0
     or (select count(*) from public.workout_session_state) <> 0
     or (select count(*) from public.workout_feedback) <> 0 then
    raise exception 'WORKOUT TEST FAILED: B can see A''s workout data';
  end if;

  -- B cannot change A's sessions or checkpoints (invisible → 0 rows).
  update public.workout_session_state set paused = false;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'WORKOUT TEST FAILED: B changed A''s checkpoint'; end if;
  update public.workout_sessions set scheduled_date = date '2026-11-10';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'WORKOUT TEST FAILED: B changed A''s session'; end if;

  -- B's own catch-up works independently of A.
  perform public.start_workout_session('00000000-0000-4000-8000-0000000000b1', date '2026-11-16');
end;
$$;

-- B cannot attach a set to A's exercise (composite FK).
reset role;
create temporary table _a_ex on commit drop as
  select id from public.workout_exercises where user_id = '00000000-0000-4000-8000-00000000000a' limit 1;
grant select on _a_ex to authenticated;
set local role authenticated;
do $$
begin
  insert into public.workout_sets (workout_exercise_id, user_id, set_number, side, target, achieved, status)
  values ((select id from _a_ex), '00000000-0000-4000-8000-00000000000b', 2, null, 12, 12, 'completed');
  raise exception 'WORKOUT TEST FAILED: B attached a set to A''s exercise';
exception when foreign_key_violation then null;
end;
$$;

reset role;

select 'ALL WORKOUT TESTS PASSED (changes rolled back)' as result;

rollback;
