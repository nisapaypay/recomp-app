-- =============================================================================
-- RECOMP · Migration 7 · Plain-language revision of exercise instructions
-- -----------------------------------------------------------------------------
-- Review of migration 6 for beginners. Replaces gym jargon with plain words:
--   hinge / hip hinge → "bend forward from the hips with a flat back"
--   brace             → "tighten your stomach muscles gently"
--   glutes            → "buttock muscles (glutes)" / "buttocks"
--   soft bend         → "slight bend"; stacked → "one on top of the other"
--   momentum          → "swinging"
-- Also moves "use no weight if 3 kg is too heavy" out of the Lateral Raise
-- movement steps (it is already listed under safe modifications).
--
-- Only the rows/fields below change. Data only, idempotent, safe to re-run.
-- Run after migration 6.
-- =============================================================================

begin;

update public.exercise_library as e
set
  description       = v.description,
  starting_position = v.starting_position,
  execution_steps   = v.execution_steps,
  breathing         = v.breathing,
  common_mistakes   = v.common_mistakes
from (values
  ('glute-bridge',
   'Lying hip lift that works the buttock muscles (glutes).',
   'Lie on your back on a folded towel or carpet, knees bent, feet flat and hip-width apart, arms by your sides.',
   array['Press through the heels and squeeze your buttocks.',
         'Lift the hips until shoulders, hips and knees form a straight line.',
         'Hold briefly at the top.',
         'Lower the hips back down slowly.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Arching the lower back at the top.', 'Pushing through the toes instead of the heels.', 'Dropping down too fast.']),

  ('donkey-kick',
   'Kneeling leg lift for the buttock muscles (glutes).',
   'Kneel on a folded towel on hands and knees: hands under shoulders, knees under hips, back flat like a table.',
   array['Keep the knee bent at a right angle.',
         'Lift one leg up behind you, sole of the foot towards the ceiling.',
         'Stop when the thigh is about level with your back.',
         'Lower slowly. Finish all reps on one side, then switch.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Arching the lower back to lift higher.', 'Swinging the leg instead of lifting it slowly.', 'Leaning the hips to one side.']),

  ('side-lying-leg-raise',
   'Lying side leg lift for the outer hip.',
   'Lie on your side on a towel or carpet, legs straight and one on top of the other. Rest your head on your lower arm.',
   array['Keep the top leg straight and the toes pointing forward.',
         'Lift the top leg to a comfortable height.',
         'Lower slowly. Finish all reps on one side, then switch.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Rolling the hips backward.', 'Turning the toes up to the ceiling.', 'Swinging the leg.']),

  ('standing-knee-raise',
   'Standing knee lift, one leg at a time.',
   'Stand tall with feet hip-width apart. Hold a wall or chair for balance if needed.',
   array['Tighten your stomach muscles gently.',
         'Lift one knee towards hip height.',
         'Lower slowly. Finish all reps on one side, then switch.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Leaning backward.', 'Rounding the back to lift the knee higher.']),

  ('plank',
   'Holding a straight body position to strengthen the stomach and shoulders.',
   'Forearms on a towel or carpet, elbows under shoulders, legs straight behind you, resting on your toes.',
   array['Keep a straight line from head to heels.',
         'Tighten your stomach muscles gently and squeeze your buttocks.',
         'Hold the position for the prescribed time.'],
   'Breathe slowly and steadily. Do not hold your breath.',
   array['Hips sagging towards the floor.', 'Hips pushed up too high.', 'Holding the breath.']),

  ('dumbbell-glute-bridge',
   'Glute bridge with a dumbbell resting on the hips.',
   'Lie on your back, knees bent, feet flat. Hold one dumbbell across the front of your hips with both hands.',
   array['Press through the heels and squeeze your buttocks.',
         'Lift the hips until shoulders, hips and knees form a straight line.',
         'Hold briefly at the top.',
         'Lower slowly.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Arching the lower back.', 'Letting the dumbbell roll.', 'Pushing through the toes.']),

  ('shoulder-press',
   'Pressing dumbbells overhead.',
   'Stand or sit tall. Hold the dumbbells at shoulder height, palms facing forward.',
   array['Tighten your stomach muscles gently.',
         'Press the dumbbells up until the arms are straight overhead.',
         'Lower back to shoulder height slowly.'],
   'Breathe out as you press, breathe in as you lower.',
   array['Arching the lower back.', 'Lifting the shoulders up towards the ears.', 'Snapping the elbows straight at the top.']),

  ('one-arm-dumbbell-row',
   'Pulling a dumbbell towards the hip with one arm, supported on a chair or bed.',
   'Place one hand on a chair or bed. Bend forward from the hips with a flat back, holding a dumbbell in the other hand with the arm hanging straight down.',
   array['Pull the dumbbell up towards the hip, keeping the elbow close to the body.',
         'Squeeze the shoulder blade towards the spine at the top.',
         'Lower slowly. Finish all reps on one side, then switch.'],
   'Breathe out as you pull, breathe in as you lower.',
   array['Twisting the upper body.', 'Rounding the back.', 'Jerking the weight up.']),

  ('lateral-raise',
   'Raising dumbbells out to the sides.',
   'Stand tall holding the dumbbells at your sides with a slight bend in the elbows.',
   array['Raise the arms out to the sides.',
         'Stop at shoulder height or lower.',
         'Lower slowly.'],
   'Breathe out as you raise, breathe in as you lower.',
   array['Lifting the shoulders up towards the ears.', 'Swinging the weights.', 'Raising above shoulder height.']),

  ('dumbbell-romanian-deadlift',
   'Bending forward from the hips with a flat back while holding dumbbells.',
   'Stand with feet hip-width apart, holding the dumbbells in front of your thighs.',
   array['Keep a slight bend in the knees.',
         'Push the hips back and slide the dumbbells down the front of the legs.',
         'Keep the back flat. Stop when you feel a stretch in the back of the legs, or before the back starts to round.',
         'Squeeze your buttocks and push the hips forward to stand up.'],
   'Breathe in as you lower, breathe out as you stand up.',
   array['Rounding the back.', 'Bending the knees into a squat.', 'Letting the dumbbells drift away from the legs.']),

  ('bent-over-row',
   'Pulling two dumbbells towards the body while bent forward.',
   'Hold a dumbbell in each hand. Bend forward from the hips with a flat back and slightly bent knees, arms hanging straight down.',
   array['Pull the dumbbells up towards the lower ribs.',
         'Squeeze the shoulder blades together.',
         'Lower slowly.'],
   'Breathe out as you pull, breathe in as you lower.',
   array['Rounding the back.', 'Standing up during the pull.', 'Swinging the weights up.'])
) as v(id, description, starting_position, execution_steps, breathing, common_mistakes)
where e.id = v.id;

-- Fail if any of the 11 rows was not found (slug typo).
do $$
begin
  if (select count(*) from public.exercise_library
      where id in ('glute-bridge', 'donkey-kick', 'side-lying-leg-raise', 'standing-knee-raise', 'plank',
                   'dumbbell-glute-bridge', 'shoulder-press', 'one-arm-dumbbell-row', 'lateral-raise',
                   'dumbbell-romanian-deadlift', 'bent-over-row')
        and description is not null) <> 11 then
    raise exception 'Plain-language revision did not find all 11 exercises';
  end if;
end;
$$;

commit;
