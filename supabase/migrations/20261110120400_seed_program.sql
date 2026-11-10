-- =============================================================================
-- RECOMP · Migration 5/5 · Seed the 12-week program (reference data)
-- -----------------------------------------------------------------------------
-- program_days      : 84 rows (12 weeks × 7 days), fixed weekly schedule,
--                     with walking targets for Tuesday and Saturday.
-- program_exercises : base prescriptions for Mon / Wed / Fri, exactly as the
--                     master specification. Tempo/rest NULL = library default.
--
-- Thursday (Recovery / Stretching) routine content is authored in Phase 3.
-- Idempotent: rows for weeks 1–12 are replaced on re-run. This is reference
-- data only; it contains no personal data.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Fixed weekly schedule
-- -----------------------------------------------------------------------------
delete from public.program_exercises where week_number between 1 and 12;
delete from public.program_days      where week_number between 1 and 12;

insert into public.program_days (week_number, day_of_week, activity_type, walking_target_min_minutes, walking_target_max_minutes)
select
  w.week,
  d.dow,
  d.activity,
  case when d.activity = 'walking' then
    case
      when w.week = 1              then 20
      when w.week between 2 and 4  then 20
      when w.week between 5 and 8  then case d.dow when 2 then 25 else 30 end
      else 30
    end
  end,
  case when d.activity = 'walking' then
    case
      when w.week = 1              then 20
      when w.week between 2 and 4  then 25
      when w.week between 5 and 8  then case d.dow when 2 then 25 else 30 end
      else 30
    end
  end
from generate_series(1, 12) as w(week)
cross join (values
  (1, 'lower_body'),
  (2, 'walking'),
  (3, 'upper_body_core'),
  (4, 'recovery'),
  (5, 'full_body_core'),
  (6, 'walking'),
  (7, 'rest')
) as d(dow, activity);

-- -----------------------------------------------------------------------------
-- Prescriptions. Each row applies to weeks first_week..last_week.
-- target_min/target_max = reps (or seconds for plank), per side when unilateral.
-- -----------------------------------------------------------------------------
insert into public.program_exercises (
  week_number, day_of_week, order_index, exercise_id, sets, target_min, target_max, notes
)
select w.week, p.dow, p.ord, p.exercise_id, p.sets, p.tmin, p.tmax, p.notes
from (values
  -- first, last, dow, ord, exercise_id, sets, min, max, notes
  -- ===== Week 1 · Foundation (bodyweight) =====
  (1, 1, 1, 1, 'bodyweight-squat',            2, 12, 12, null),
  (1, 1, 1, 2, 'glute-bridge',                2, 15, 15, null),
  (1, 1, 1, 3, 'reverse-lunge',               2, 10, 10, null),
  (1, 1, 1, 4, 'donkey-kick',                 2, 12, 12, null),
  (1, 1, 1, 5, 'calf-raise',                  2, 15, 15, null),

  (1, 1, 3, 1, 'wall-push-up',                2, 12, 12, null),
  (1, 1, 3, 2, 'arm-circles',                 2, 15, 15, 'Each direction'),
  (1, 1, 3, 3, 'bird-dog',                    2, 10, 10, null),
  (1, 1, 3, 4, 'dead-bug',                    2, 10, 10, null),
  (1, 1, 3, 5, 'prone-w-raise',               2, 12, 12, null),

  (1, 1, 5, 1, 'sumo-squat',                  2, 12, 12, null),
  (1, 1, 5, 2, 'side-lying-leg-raise',        2, 12, 12, null),
  (1, 1, 5, 3, 'wall-push-up',                2, 12, 12, null),
  (1, 1, 5, 4, 'glute-bridge',                2, 15, 15, null),
  (1, 1, 5, 5, 'standing-knee-raise',         2, 15, 15, null),
  (1, 1, 5, 6, 'plank',                       2, 15, 20, 'Seconds'),

  -- ===== Weeks 2–4 · Beginner Strength (2 × 3 kg dumbbells) =====
  (2, 4, 1, 1, 'goblet-squat',                2, 12, 12, null),
  (2, 4, 1, 2, 'dumbbell-glute-bridge',       2, 15, 15, null),
  (2, 4, 1, 3, 'dumbbell-reverse-lunge',      2, 10, 10, null),
  (2, 4, 1, 4, 'donkey-kick',                 2, 15, 15, null),
  (2, 4, 1, 5, 'dumbbell-calf-raise',         2, 15, 15, null),

  (2, 4, 3, 1, 'shoulder-press',              2, 10, 10, null),
  (2, 4, 3, 2, 'one-arm-dumbbell-row',        2, 12, 12, null),
  (2, 4, 3, 3, 'bicep-curl',                  2, 12, 12, null),
  (2, 4, 3, 4, 'lateral-raise',               2, 10, 10, 'Use no weight if 3 kg is too heavy'),
  (2, 4, 3, 5, 'overhead-triceps-extension',  2, 12, 12, null),
  (2, 4, 3, 6, 'dead-bug',                    2, 10, 10, null),

  (2, 4, 5, 1, 'sumo-squat',                  2, 12, 12, null),
  (2, 4, 5, 2, 'dumbbell-romanian-deadlift',  2, 12, 12, null),
  (2, 4, 5, 3, 'bent-over-row',               2, 12, 12, null),
  (2, 4, 5, 4, 'side-lying-leg-raise',        2, 15, 15, null),
  (2, 4, 5, 5, 'dumbbell-glute-bridge',       2, 15, 15, null),
  (2, 4, 5, 6, 'plank',                       2, 20, 20, 'Seconds'),

  -- ===== Weeks 5–8 · Progressive Overload =====
  (5, 8, 1, 1, 'goblet-squat',                3, 12, 15, null),
  (5, 8, 1, 2, 'dumbbell-glute-bridge',       3, 15, 15, null),
  (5, 8, 1, 3, 'dumbbell-reverse-lunge',      3, 10, 10, null),
  (5, 8, 1, 4, 'donkey-kick',                 2, 15, 15, null),
  (5, 8, 1, 5, 'dumbbell-calf-raise',         3, 15, 15, null),

  (5, 8, 3, 1, 'shoulder-press',              3, 10, 12, null),
  (5, 8, 3, 2, 'one-arm-dumbbell-row',        3, 12, 12, null),
  (5, 8, 3, 3, 'bicep-curl',                  2, 12, 12, null),
  (5, 8, 3, 4, 'lateral-raise',               2, 12, 12, 'Use no weight if 3 kg is too heavy'),
  (5, 8, 3, 5, 'overhead-triceps-extension',  2, 12, 12, null),
  (5, 8, 3, 6, 'dead-bug',                    3, 10, 10, null),

  (5, 8, 5, 1, 'dumbbell-sumo-squat',         3, 12, 15, null),
  (5, 8, 5, 2, 'dumbbell-romanian-deadlift',  3, 12, 12, null),
  (5, 8, 5, 3, 'bent-over-row',               3, 12, 12, null),
  (5, 8, 5, 4, 'side-lying-leg-raise',        2, 15, 15, null),
  (5, 8, 5, 5, 'dumbbell-glute-bridge',       3, 15, 15, null),
  (5, 8, 5, 6, 'plank',                       3, 20, 30, 'Seconds'),

  -- ===== Weeks 9–12 · Strengthening =====
  (9, 12, 1, 1, 'goblet-squat',               3, 15, 15, null),
  (9, 12, 1, 2, 'dumbbell-glute-bridge',      3, 15, 15, null),
  (9, 12, 1, 3, 'dumbbell-reverse-lunge',     3, 12, 12, null),
  (9, 12, 1, 4, 'donkey-kick',                3, 15, 15, null),
  (9, 12, 1, 5, 'dumbbell-calf-raise',        3, 15, 15, null),

  (9, 12, 3, 1, 'shoulder-press',             3, 10, 12, null),
  (9, 12, 3, 2, 'one-arm-dumbbell-row',       3, 12, 12, null),
  (9, 12, 3, 3, 'bicep-curl',                 3, 12, 12, null),
  (9, 12, 3, 4, 'lateral-raise',              2, 12, 12, 'Use no weight if 3 kg is too heavy'),
  (9, 12, 3, 5, 'overhead-triceps-extension', 3, 12, 12, null),
  (9, 12, 3, 6, 'dead-bug',                   3, 12, 12, null),

  (9, 12, 5, 1, 'dumbbell-sumo-squat',        3, 15, 15, null),
  (9, 12, 5, 2, 'dumbbell-romanian-deadlift', 3, 15, 15, null),
  (9, 12, 5, 3, 'bent-over-row',              3, 12, 12, null),
  (9, 12, 5, 4, 'side-lying-leg-raise',       3, 15, 15, null),
  (9, 12, 5, 5, 'dumbbell-glute-bridge',      3, 15, 15, null),
  (9, 12, 5, 6, 'plank',                      3, 30, 30, 'Seconds')
) as p(first_week, last_week, dow, ord, exercise_id, sets, tmin, tmax, notes)
join generate_series(1, 12) as w(week)
  on w.week between p.first_week and p.last_week;

-- Sanity checks: fail the migration if the seed is incomplete.
do $$
declare
  n_days int;
  n_ex int;
begin
  select count(*) into n_days from public.program_days;
  select count(*) into n_ex from public.program_exercises;
  if n_days <> 84 then
    raise exception 'Expected 84 program_days, found %', n_days;
  end if;
  -- Week 1: 5+5+6 = 16; Weeks 2–12: 5+6+6 = 17 each → 16 + 11 × 17 = 203
  if n_ex <> 203 then
    raise exception 'Expected 203 program_exercises, found %', n_ex;
  end if;
end;
$$;

commit;
