-- =============================================================================
-- RECOMP · Migration 4/5 · Seed exercise library (reference data)
-- -----------------------------------------------------------------------------
-- Core, structured attributes for every exercise in the 12-week program.
-- Tempo = seconds for lowering · hold · lifting. Prescribed tempos from the
-- master spec are used where given (e.g. squat 3-1-1, glute bridge 2-1-2,
-- calf raise 1-1-2); the rest are beginner-friendly defaults that the user can
-- adjust during a workout. Timed holds (plank) have no tempo.
-- Rest: 60 s default, 90 s for heavier dumbbell compounds.
--
-- Instructional text (description, steps, breathing, mistakes) and
-- illustrations are authored in Phase 3 and added by a later migration.
-- Idempotent: re-running updates the same rows.
-- =============================================================================

begin;

insert into public.exercise_library (
  id, name, category, target_muscles, equipment, measure_type, side_mode,
  tempo_eccentric_s, tempo_pause_s, tempo_concentric_s, default_rest_seconds,
  difficulty, safe_modifications
) values
  -- Bodyweight ---------------------------------------------------------------
  ('bodyweight-squat',      'Bodyweight Squat',      'lower_body', '{quadriceps,glutes,hamstrings}',          'bodyweight', 'reps',    'none',          3, 1, 1, 60, 'beginner', '{"Squat to a chair or bed edge to control depth"}'),
  ('glute-bridge',          'Glute Bridge',          'lower_body', '{glutes,hamstrings,core}',                'bodyweight', 'reps',    'none',          2, 1, 2, 60, 'beginner', '{}'),
  ('reverse-lunge',         'Reverse Lunge',         'lower_body', '{quadriceps,glutes,hamstrings}',          'bodyweight', 'reps',    'per_side',      2, 1, 2, 60, 'beginner', '{"Hold a wall or chair for balance","Shorten the step and reduce depth"}'),
  ('donkey-kick',           'Donkey Kick',           'lower_body', '{glutes}',                                'bodyweight', 'reps',    'per_side',      2, 1, 2, 60, 'beginner', '{"Place a folded towel under the knees"}'),
  ('calf-raise',            'Calf Raise',            'lower_body', '{calves}',                                'bodyweight', 'reps',    'none',          1, 1, 2, 60, 'beginner', '{"Hold a wall for balance"}'),
  ('wall-push-up',          'Wall Push Up',          'upper_body', '{chest,shoulders,triceps}',               'bodyweight', 'reps',    'none',          2, 1, 1, 60, 'beginner', '{"Stand closer to the wall to make it easier"}'),
  ('arm-circles',           'Arm Circles',           'upper_body', '{shoulders}',                             'bodyweight', 'reps',    'per_direction', 1, 0, 1, 60, 'beginner', '{"Make smaller circles"}'),
  ('bird-dog',              'Bird Dog',              'core',       '{core,glutes,lower_back}',                'bodyweight', 'reps',    'per_side',      2, 1, 2, 60, 'beginner', '{"Move only the leg, keep both hands down","Place a folded towel under the knees"}'),
  ('dead-bug',              'Dead Bug',              'core',       '{core}',                                  'bodyweight', 'reps',    'per_side',      2, 1, 2, 60, 'beginner', '{"Move only the legs, keep arms still","Keep knees bent"}'),
  ('prone-w-raise',         'Prone W Raise',         'upper_body', '{upper_back,rear_shoulders}',             'bodyweight', 'reps',    'none',          2, 1, 2, 60, 'beginner', '{"Lift the arms only a little"}'),
  ('sumo-squat',            'Sumo Squat',            'lower_body', '{quadriceps,glutes,adductors}',           'bodyweight', 'reps',    'none',          3, 1, 1, 60, 'beginner', '{"Reduce depth"}'),
  ('side-lying-leg-raise',  'Side-Lying Leg Raise',  'lower_body', '{glute_medius,hip_abductors}',            'bodyweight', 'reps',    'per_side',      2, 1, 2, 60, 'beginner', '{"Lower the range of motion"}'),
  ('standing-knee-raise',   'Standing Knee Raise',   'core',       '{core,hip_flexors}',                      'bodyweight', 'reps',    'per_side',      1, 1, 1, 60, 'beginner', '{"Hold a wall or chair for balance"}'),
  ('plank',                 'Plank',                 'core',       '{core,shoulders}',                        'bodyweight', 'seconds', 'none',          null, null, null, 60, 'beginner', '{"Plank from the knees","Incline plank with hands on a bed or table"}'),
  -- Dumbbells (2 × 3 kg) ------------------------------------------------------
  ('goblet-squat',               'Goblet Squat',               'lower_body', '{quadriceps,glutes,core}',          'dumbbells', 'reps', 'none',     3, 1, 1, 90, 'beginner', '{"Use one dumbbell or bodyweight only"}'),
  ('dumbbell-glute-bridge',      'Dumbbell Glute Bridge',      'lower_body', '{glutes,hamstrings}',               'dumbbells', 'reps', 'none',     2, 1, 2, 60, 'beginner', '{"Do it without the dumbbell"}'),
  ('dumbbell-reverse-lunge',     'Dumbbell Reverse Lunge',     'lower_body', '{quadriceps,glutes,hamstrings}',    'dumbbells', 'reps', 'per_side', 2, 1, 2, 90, 'beginner', '{"Hold one dumbbell only, or none","Hold a wall for balance"}'),
  ('dumbbell-calf-raise',        'Dumbbell Calf Raise',        'lower_body', '{calves}',                          'dumbbells', 'reps', 'none',     1, 1, 2, 60, 'beginner', '{"Do it without dumbbells"}'),
  ('shoulder-press',             'Shoulder Press',             'upper_body', '{shoulders,triceps}',               'dumbbells', 'reps', 'none',     2, 1, 1, 60, 'beginner', '{"Press one arm at a time","Sit on a chair for support"}'),
  ('one-arm-dumbbell-row',       'One-Arm Dumbbell Row',       'upper_body', '{upper_back,lats,biceps}',          'dumbbells', 'reps', 'per_side', 2, 1, 1, 60, 'beginner', '{"Support the free hand on a chair or bed"}'),
  ('bicep-curl',                 'Bicep Curl',                 'upper_body', '{biceps,forearms}',                 'dumbbells', 'reps', 'none',     2, 1, 1, 60, 'beginner', '{"Curl one arm at a time"}'),
  ('lateral-raise',              'Lateral Raise',              'upper_body', '{shoulders}',                       'dumbbells', 'reps', 'none',     2, 1, 1, 60, 'beginner', '{"Use no weight if 3 kg is too heavy","Raise only to shoulder height or lower"}'),
  ('overhead-triceps-extension', 'Overhead Triceps Extension', 'upper_body', '{triceps}',                         'dumbbells', 'reps', 'none',     2, 1, 1, 60, 'beginner', '{"Hold one dumbbell with both hands","Sit on a chair for support"}'),
  ('dumbbell-romanian-deadlift', 'Dumbbell Romanian Deadlift', 'lower_body', '{hamstrings,glutes,lower_back}',    'dumbbells', 'reps', 'none',     3, 1, 1, 90, 'beginner', '{"Reduce depth; stop when the back starts to round"}'),
  ('bent-over-row',              'Bent-Over Row',              'upper_body', '{upper_back,lats,biceps}',          'dumbbells', 'reps', 'none',     2, 1, 1, 60, 'beginner', '{"Support the chest with one hand on a table and row one arm"}'),
  ('dumbbell-sumo-squat',        'Dumbbell Sumo Squat',        'lower_body', '{quadriceps,glutes,adductors}',     'dumbbells', 'reps', 'none',     3, 1, 1, 90, 'beginner', '{"Use bodyweight only","Reduce depth"}')
on conflict (id) do update set
  name                 = excluded.name,
  category             = excluded.category,
  target_muscles       = excluded.target_muscles,
  equipment            = excluded.equipment,
  measure_type         = excluded.measure_type,
  side_mode            = excluded.side_mode,
  tempo_eccentric_s    = excluded.tempo_eccentric_s,
  tempo_pause_s        = excluded.tempo_pause_s,
  tempo_concentric_s   = excluded.tempo_concentric_s,
  default_rest_seconds = excluded.default_rest_seconds,
  difficulty           = excluded.difficulty,
  safe_modifications   = excluded.safe_modifications;

commit;
