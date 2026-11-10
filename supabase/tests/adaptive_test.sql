-- =============================================================================
-- RECOMP · Adaptive progression test (Phase 5)
-- -----------------------------------------------------------------------------
-- Run AFTER all migrations (1–10), in Supabase → SQL Editor. Everything (test
-- users, data, a temporarily fixed "today") is ROLLED BACK at the end.
-- Success = a row "ALL ADAPTIVE TESTS PASSED (changes rolled back)".
--
-- Program starts Monday 9 Nov 2026. Week 2 Monday 16 Nov = Lower Body:
-- goblet squat 2×12, DB glute bridge 2×15, DB reverse lunge 2×10/side,
-- donkey kick 2×15/side, DB calf raise 2×15.
-- =============================================================================

begin;

create or replace function public.recomp_today() returns date
language sql stable set search_path = '' as $$ select date '2026-11-17' $$;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000aa', 'adaptive-test-a@example.invalid'),
  ('00000000-0000-4000-8000-0000000000bb', 'adaptive-test-b@example.invalid');

insert into public.user_programs (id, user_id, start_date) values
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000aa', date '2026-11-09'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000bb', date '2026-11-09');

-- Metadata sanity (reference data, readable by everyone signed in).
do $$
begin
  if (select movement_type from public.exercise_library where id = 'goblet-squat') <> 'compound'
     or (select movement_type from public.exercise_library where id = 'bicep-curl') <> 'isolation'
     or (select movement_type from public.exercise_library where id = 'dead-bug') <> 'core'
     or (select progression_step from public.exercise_library where id = 'plank') <> 5
     or (select max_extra_sets from public.exercise_library where id = 'plank') <> 0
     or (select progression_step from public.exercise_library where id = 'arm-circles') <> 0
     or (select progression_step from public.exercise_library where id = 'dumbbell-reverse-lunge') <> 1 then
    raise exception 'ADAPTIVE TEST FAILED: progression metadata wrong';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------- A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000aa","role":"authenticated"}', true);

do $$
declare
  p   constant uuid := '00000000-0000-4000-8000-0000000000a2';
  mon uuid; created boolean; fb uuid; adj uuid; adj2 uuid; n int;
  good constant jsonb := '{"exercise_id":"goblet-squat","change_type":"increase_target","previous_sets":2,"previous_target":12,"new_sets":2,"new_target":14,"reason":"Too easy: 12 → 14 reps."}';
begin
  select out_session_id, out_created into mon, created from public.start_workout_session(p, date '2026-11-16');

  -- Feedback on an unfinished workout is refused.
  begin
    perform public.save_workout_feedback(mon, 'too_easy', false, null, null);
    raise exception 'ADAPTIVE TEST FAILED: feedback on an unfinished workout';
  exception when raise_exception then
    if sqlerrm <> 'not_completed' then raise; end if;
  end;

  -- Finish it: everything completed except donkey kick (skipped).
  update public.workout_exercises set status = 'completed', completed_sets = prescribed_sets
  where session_id = mon and exercise_id <> 'donkey-kick';
  update public.workout_exercises set status = 'skipped' where session_id = mon and exercise_id = 'donkey-kick';
  update public.workout_sessions
  set status = 'completed', performed_at = now(), completed_at = now(), duration_seconds = 1500
  where id = mon;

  -- Invalid adjustments are refused (and nothing is written).
  begin
    perform public.save_workout_feedback(mon, 'too_easy', false, null, jsonb_set(good, '{new_target}', '17'));
    raise exception 'ADAPTIVE TEST FAILED: step larger than allowed';
  exception when raise_exception then if sqlerrm <> 'invalid_adjustment' then raise; end if; end;
  begin
    perform public.save_workout_feedback(mon, 'too_easy', false, null, jsonb_set(good, '{new_target}', '18'));
    raise exception 'ADAPTIVE TEST FAILED: above ceiling allowed';
  exception when raise_exception then if sqlerrm <> 'invalid_adjustment' then raise; end if; end;
  begin
    perform public.save_workout_feedback(mon, 'too_easy', false, null,
      '{"exercise_id":"goblet-squat","change_type":"increase_target","previous_sets":3,"previous_target":12,"new_sets":3,"new_target":14,"reason":"x"}');
    raise exception 'ADAPTIVE TEST FAILED: previous values not checked';
  exception when raise_exception then if sqlerrm <> 'invalid_adjustment' then raise; end if; end;
  begin
    perform public.save_workout_feedback(mon, 'too_easy', false, null,
      '{"exercise_id":"goblet-squat","change_type":"increase_target","previous_sets":2,"previous_target":12,"new_sets":3,"new_target":14,"reason":"x"}');
    raise exception 'ADAPTIVE TEST FAILED: two variables changed';
  exception when raise_exception then if sqlerrm <> 'invalid_adjustment' then raise; end if; end;
  begin
    perform public.save_workout_feedback(mon, 'too_easy', false, null, jsonb_set(jsonb_set(good, '{change_type}', '"decrease_target"'), '{new_target}', '10'));
    raise exception 'ADAPTIVE TEST FAILED: Too Easy decreased a target';
  exception when raise_exception then if sqlerrm <> 'invalid_adjustment' then raise; end if; end;
  begin
    perform public.save_workout_feedback(mon, 'too_easy', true, null, good);
    raise exception 'ADAPTIVE TEST FAILED: progressed through reported pain';
  exception when raise_exception then if sqlerrm <> 'progression_blocked_pain' then raise; end if; end;
  begin
    perform public.save_workout_feedback(mon, 'too_hard', false, null,
      '{"exercise_id":"donkey-kick","change_type":"decrease_target","previous_sets":2,"previous_target":15,"new_sets":2,"new_target":14,"reason":"x"}');
    raise exception 'ADAPTIVE TEST FAILED: adjusted a skipped exercise';
  exception when raise_exception then if sqlerrm <> 'exercise_not_performed' then raise; end if; end;
  begin
    perform public.save_workout_feedback(mon, 'just_right', false, null, good);
    raise exception 'ADAPTIVE TEST FAILED: Just Right changed a target';
  exception when raise_exception then if sqlerrm <> 'invalid_adjustment' then raise; end if; end;
  if exists (select 1 from public.adaptive_adjustments) then
    raise exception 'ADAPTIVE TEST FAILED: a refused call left an adjustment behind';
  end if;

  -- Valid Too Easy: one feedback + one adjustment.
  select out_feedback_id, out_adjustment_id into fb, adj from public.save_workout_feedback(mon, 'too_easy', false, ' felt light ', good);
  if fb is null or adj is null then raise exception 'ADAPTIVE TEST FAILED: valid feedback not saved'; end if;
  if not exists (select 1 from public.adaptive_adjustments
                 where id = adj and feedback_id = fb and source_session_id = mon and activity_type = 'lower_body'
                   and change_type = 'increase_target' and previous_target = 12 and new_target = 14
                   and effective_from = date '2026-11-17') then
    raise exception 'ADAPTIVE TEST FAILED: adjustment row wrong';
  end if;

  -- Submitting again replaces — never doubles — the adjustment.
  select out_adjustment_id into adj2 from public.save_workout_feedback(mon, 'too_easy', false, null, good);
  select count(*) into n from public.adaptive_adjustments;
  if n <> 1 or (select count(*) from public.workout_feedback) <> 1 then
    raise exception 'ADAPTIVE TEST FAILED: feedback processed twice';
  end if;
  -- A second adjustment for the same feedback is impossible even without the function.
  begin
    insert into public.adaptive_adjustments (user_id, exercise_id, activity_type, feedback_id, previous_sets, previous_target,
                                             new_sets, new_target, change_type, reason, effective_from)
    values ('00000000-0000-4000-8000-0000000000aa', 'dumbbell-calf-raise', 'lower_body', fb, 2, 15, 2, 17, 'increase_target', 'dup', current_date);
    raise exception 'ADAPTIVE TEST FAILED: duplicate adjustment for one feedback';
  exception when unique_violation then null;
  end;

  -- Changing the answer to Just Right removes the adjustment.
  perform public.save_workout_feedback(mon, 'just_right', false, null, null);
  if exists (select 1 from public.adaptive_adjustments) then raise exception 'ADAPTIVE TEST FAILED: correction kept the old adjustment'; end if;
  if (select difficulty from public.workout_feedback where session_id = mon) <> 'just_right' then
    raise exception 'ADAPTIVE TEST FAILED: feedback not updated';
  end if;

  -- Final answer: Too Easy again.
  perform public.save_workout_feedback(mon, 'too_easy', false, null, good);

  -- The finished workout's prescription can never change.
  begin
    update public.workout_exercises set prescribed_target = 14 where session_id = mon and exercise_id = 'goblet-squat';
    raise exception 'ADAPTIVE TEST FAILED: historical prescription changed';
  exception when insufficient_privilege then
    if sqlerrm <> 'prescription_immutable' then raise; end if;
  end;
end;
$$;

-- Next Monday: the new snapshot applies the adjustment; the old one is untouched.
reset role;
create or replace function public.recomp_today() returns date
language sql stable set search_path = '' as $$ select date '2026-11-23' $$;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000aa","role":"authenticated"}', true);

do $$
declare
  p  constant uuid := '00000000-0000-4000-8000-0000000000a2';
  mon uuid := (select id from public.workout_sessions where scheduled_date = date '2026-11-16');
  nxt uuid; created boolean;
begin
  select out_session_id, out_created into nxt, created from public.start_workout_session(p, date '2026-11-23');
  if not exists (select 1 from public.workout_exercises
                 where session_id = nxt and exercise_id = 'goblet-squat' and prescribed_target = 14 and prescribed_sets = 2
                   and adjustment_id is not null) then
    raise exception 'ADAPTIVE TEST FAILED: next workout did not apply the adjustment';
  end if;
  if not exists (select 1 from public.workout_exercises
                 where session_id = nxt and exercise_id = 'dumbbell-calf-raise' and prescribed_target = 15) then
    raise exception 'ADAPTIVE TEST FAILED: an unrelated exercise changed';
  end if;
  if not exists (select 1 from public.workout_exercises
                 where session_id = mon and exercise_id = 'goblet-squat' and prescribed_target = 12) then
    raise exception 'ADAPTIVE TEST FAILED: historical workout changed';
  end if;

  -- Once the next workout of that type has started, the old feedback is locked.
  begin
    perform public.save_workout_feedback(mon, 'too_hard', false, null, null);
    raise exception 'ADAPTIVE TEST FAILED: feedback editable after the next workout started';
  exception when raise_exception then if sqlerrm <> 'feedback_locked' then raise; end if; end;

  -- Abandon it; an abandoned/stopped workout can't receive feedback.
  update public.workout_sessions set status = 'stopped', performed_at = now(), duration_seconds = 60 where id = nxt;
  begin
    perform public.save_workout_feedback(nxt, 'too_hard', false, null, null);
    raise exception 'ADAPTIVE TEST FAILED: feedback accepted for a stopped workout';
  exception when raise_exception then if sqlerrm <> 'not_completed' then raise; end if; end;
end;
$$;

-- ----------------------------------------------------------------------------- B
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000bb","role":"authenticated"}', true);

do $$
declare
  a_mon uuid;
  p constant uuid := '00000000-0000-4000-8000-0000000000b2';
  s uuid; created boolean; adj uuid;
begin
  -- B sees none of A's feedback or adjustments.
  if (select count(*) from public.workout_feedback) <> 0 or (select count(*) from public.adaptive_adjustments) <> 0 then
    raise exception 'ADAPTIVE TEST FAILED: B can see A''s feedback or adjustments';
  end if;

  -- B can't give feedback on A's workout (it is invisible to B).
  begin
    perform public.save_workout_feedback('00000000-0000-4000-8000-000000000000', 'too_easy', false, null, null);
    raise exception 'ADAPTIVE TEST FAILED: feedback on an unknown session';
  exception when raise_exception then if sqlerrm <> 'session_not_found' then raise; end if; end;

  -- B's snapshot ignores A's adjustments.
  select out_session_id, out_created into s, created from public.start_workout_session(p, date '2026-11-16');
  if not exists (select 1 from public.workout_exercises where session_id = s and exercise_id = 'goblet-squat' and prescribed_target = 12) then
    raise exception 'ADAPTIVE TEST FAILED: A''s adjustment leaked into B''s workout';
  end if;

  -- Too Hard for B: reverse lunge (unilateral) eases by one rep per side.
  update public.workout_exercises set status = 'completed', completed_sets = prescribed_sets
  where session_id = s and exercise_id <> 'dumbbell-reverse-lunge';
  update public.workout_exercises set status = 'partial', completed_sets = 2
  where session_id = s and exercise_id = 'dumbbell-reverse-lunge';
  update public.workout_sessions set status = 'completed', performed_at = now(), completed_at = now() where id = s;
  begin
    perform public.save_workout_feedback(s, 'too_hard', false, null,
      '{"exercise_id":"dumbbell-reverse-lunge","change_type":"decrease_target","previous_sets":2,"previous_target":10,"new_sets":2,"new_target":8,"reason":"x"}');
    raise exception 'ADAPTIVE TEST FAILED: unilateral step of 2 allowed';
  exception when raise_exception then if sqlerrm <> 'invalid_adjustment' then raise; end if; end;
  select out_adjustment_id into adj from public.save_workout_feedback(s, 'too_hard', false, null,
    '{"exercise_id":"dumbbell-reverse-lunge","change_type":"decrease_target","previous_sets":2,"previous_target":10,"new_sets":2,"new_target":9,"reason":"Too hard: 10 → 9 per side."}');
  if adj is null then raise exception 'ADAPTIVE TEST FAILED: valid Too Hard not saved'; end if;
end;
$$;

-- B cannot attach an adjustment to A's feedback (composite FK).
reset role;
create temporary table _a_fb on commit drop as
  select id from public.workout_feedback where user_id = '00000000-0000-4000-8000-0000000000aa';
grant select on _a_fb to authenticated;
set local role authenticated;
do $$
begin
  insert into public.adaptive_adjustments (user_id, exercise_id, activity_type, feedback_id, previous_sets, previous_target,
                                           new_sets, new_target, change_type, reason, effective_from)
  values ('00000000-0000-4000-8000-0000000000bb', 'goblet-squat', 'lower_body', (select id from _a_fb), 2, 12, 2, 14,
          'increase_target', 'x', current_date);
  raise exception 'ADAPTIVE TEST FAILED: B linked an adjustment to A''s feedback';
-- Refused by the composite FK (or by the one-adjustment-per-feedback index first).
exception when foreign_key_violation or unique_violation then null;
end;
$$;

reset role;

select 'ALL ADAPTIVE TESTS PASSED (changes rolled back)' as result;

rollback;
