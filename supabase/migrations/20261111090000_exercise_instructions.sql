-- =============================================================================
-- RECOMP · Migration 6 · Exercise instructions (reference data)
-- -----------------------------------------------------------------------------
-- Adds instructional text to the 26 seeded exercises: short description,
-- starting position, execution steps, breathing and common mistakes.
--
-- Content policy: general, widely used beginner coaching cues only — no
-- medical or anatomical claims beyond the target muscles already seeded.
-- Written for home use without a mat (a folded towel is suggested for
-- kneeling / floor positions). Flagged for review by the user; the app
-- shows it as general guidance and tells the user to stop on pain.
--
-- Updates rows only (no schema change). Idempotent; safe to re-run.
-- Illustrations are not added yet: illustration_path stays NULL and the
-- app shows a placeholder.
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
  -- ---------------------------------------------------------------- bodyweight
  ('bodyweight-squat',
   'A basic squat using body weight only.',
   'Stand with feet about shoulder-width apart, toes turned slightly out, arms in front for balance.',
   array['Push the hips back and bend the knees to lower down.',
         'Keep the chest up and the heels on the floor.',
         'Lower to a comfortable depth, ideally thighs near parallel to the floor.',
         'Push through the whole foot to stand back up.'],
   'Breathe in as you lower, breathe out as you stand up.',
   array['Heels lifting off the floor.', 'Knees collapsing inward.', 'Rounding the back.']),

  ('glute-bridge',
   'Lying hip lift that works the glutes.',
   'Lie on your back on a folded towel or carpet, knees bent, feet flat and hip-width apart, arms by your sides.',
   array['Press through the heels and squeeze the glutes.',
         'Lift the hips until shoulders, hips and knees form a straight line.',
         'Hold briefly at the top.',
         'Lower the hips back down with control.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Arching the lower back at the top.', 'Pushing through the toes instead of the heels.', 'Dropping down too fast.']),

  ('reverse-lunge',
   'Step-back lunge, one leg at a time.',
   'Stand tall with feet hip-width apart. Hold a wall or chair for balance if needed.',
   array['Step one foot back and lower until both knees are bent.',
         'Keep the front knee over the middle of the front foot.',
         'Keep the torso upright.',
         'Push through the front heel to return to standing.',
         'Finish all reps on one side, then switch.'],
   'Breathe in as you step back and lower, breathe out as you return.',
   array['Front knee drifting inward.', 'Leaning far forward.', 'Taking a step that is too short.']),

  ('donkey-kick',
   'Kneeling leg lift for the glutes.',
   'Kneel on a folded towel on all fours: hands under shoulders, knees under hips, back flat.',
   array['Keep the knee bent at about 90 degrees.',
         'Lift one leg up behind you, sole of the foot towards the ceiling.',
         'Stop when the thigh is about level with the body.',
         'Lower with control. Finish one side, then switch.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Arching the lower back to lift higher.', 'Swinging the leg with momentum.', 'Shifting the hips to one side.']),

  ('calf-raise',
   'Standing heel raise.',
   'Stand tall with feet hip-width apart, lightly holding a wall for balance.',
   array['Rise up onto the balls of the feet.',
         'Pause at the top.',
         'Lower the heels slowly back to the floor.'],
   'Breathe out as you rise, breathe in as you lower.',
   array['Bouncing quickly.', 'Rolling onto the outside of the feet.']),

  ('wall-push-up',
   'Push-up against a wall, a beginner-friendly version of the push-up.',
   'Stand about an arm''s length from a wall. Place hands on the wall at chest height, slightly wider than shoulders.',
   array['Keep the body in a straight line from head to heels.',
         'Bend the elbows to bring the chest towards the wall.',
         'Push back to straight arms.'],
   'Breathe in as you lower towards the wall, breathe out as you push away.',
   array['Sagging hips.', 'Elbows flaring straight out to the sides.', 'Moving the head forward instead of the chest.']),

  ('arm-circles',
   'Controlled shoulder circles with straight arms.',
   'Stand tall with arms stretched out to the sides at shoulder height.',
   array['Make small, controlled circles with both arms.',
         'Complete the reps in one direction (forward).',
         'Then complete the same reps in the other direction (backward).'],
   'Breathe steadily throughout.',
   array['Shrugging the shoulders up.', 'Letting the arms drop below shoulder height.', 'Making the circles fast and jerky.']),

  ('bird-dog',
   'Kneeling opposite arm and leg reach for core stability.',
   'Kneel on a folded towel on all fours: hands under shoulders, knees under hips, back flat.',
   array['Reach one arm forward and the opposite leg back at the same time.',
         'Keep the hips level and the back flat.',
         'Hold briefly, then return to the start.',
         'Finish the reps on one side, then switch sides.'],
   'Breathe out as you reach, breathe in as you return.',
   array['Rotating the hips open.', 'Arching the lower back.', 'Lifting the leg too high.']),

  ('dead-bug',
   'Lying core exercise with opposite arm and leg movement.',
   'Lie on your back on a folded towel or carpet. Arms point to the ceiling, knees bent at 90 degrees above the hips.',
   array['Gently press the lower back towards the floor.',
         'Slowly lower one arm overhead and the opposite leg towards the floor.',
         'Go only as low as you can while keeping the lower back down.',
         'Return to the start. Finish one side, then switch.'],
   'Breathe out as you extend, breathe in as you return.',
   array['Lower back lifting off the floor.', 'Moving too fast.', 'Holding the breath.']),

  ('prone-w-raise',
   'Face-down arm raise in a W shape for the upper back.',
   'Lie face down on a towel or carpet, forehead resting on a folded towel. Bend the elbows so the arms form a W beside the body.',
   array['Squeeze the shoulder blades together and down.',
         'Lift the arms a little off the floor.',
         'Hold briefly, then lower with control.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Lifting the head and neck.', 'Shrugging the shoulders towards the ears.', 'Arching the lower back to lift higher.']),

  ('sumo-squat',
   'Wide-stance squat using body weight.',
   'Stand with feet wider than shoulder-width, toes turned out.',
   array['Bend the knees and lower the hips straight down.',
         'Keep the knees pointing in the same direction as the toes.',
         'Keep the chest up.',
         'Press through the heels to stand up.'],
   'Breathe in as you lower, breathe out as you stand up.',
   array['Knees caving inward.', 'Leaning forward.', 'Heels lifting.']),

  ('side-lying-leg-raise',
   'Lying side leg lift for the outer hip.',
   'Lie on your side on a towel or carpet with legs straight and stacked. Rest your head on your lower arm.',
   array['Keep the top leg straight and toes pointing forward.',
         'Lift the top leg to a comfortable height.',
         'Lower with control. Finish one side, then switch.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Rolling the hips backward.', 'Turning the toes up to the ceiling.', 'Swinging the leg.']),

  ('standing-knee-raise',
   'Standing alternating knee lift.',
   'Stand tall with feet hip-width apart. Hold a wall or chair for balance if needed.',
   array['Brace the stomach gently.',
         'Lift one knee towards hip height.',
         'Lower with control. Finish one side, then switch.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Leaning backward.', 'Rounding the back to lift the knee higher.']),

  ('plank',
   'Static hold for core and shoulder stability.',
   'Forearms on a towel or carpet, elbows under shoulders, legs straight behind you on the toes.',
   array['Keep a straight line from head to heels.',
         'Gently brace the stomach and squeeze the glutes.',
         'Hold the position for the prescribed time.'],
   'Breathe steadily. Do not hold your breath.',
   array['Hips sagging.', 'Hips raised too high.', 'Holding the breath.']),

  -- ---------------------------------------------------------------- dumbbells
  ('goblet-squat',
   'Squat holding one dumbbell at the chest.',
   'Stand with feet shoulder-width apart. Hold one dumbbell vertically against the chest with both hands.',
   array['Push the hips back and bend the knees to lower.',
         'Keep the chest up and the dumbbell close to the body.',
         'Lower to a comfortable depth.',
         'Push through the whole foot to stand up.'],
   'Breathe in as you lower, breathe out as you stand up.',
   array['Heels lifting.', 'Knees collapsing inward.', 'Letting the dumbbell pull the chest forward.']),

  ('dumbbell-glute-bridge',
   'Glute bridge with a dumbbell resting on the hips.',
   'Lie on your back, knees bent, feet flat. Hold one dumbbell across the hip bones with both hands.',
   array['Press through the heels and squeeze the glutes.',
         'Lift the hips until shoulders, hips and knees form a straight line.',
         'Hold briefly at the top.',
         'Lower with control.'],
   'Breathe out as you lift, breathe in as you lower.',
   array['Arching the lower back.', 'Letting the dumbbell roll.', 'Pushing through the toes.']),

  ('dumbbell-reverse-lunge',
   'Step-back lunge holding dumbbells at your sides.',
   'Stand tall holding a dumbbell in each hand at your sides.',
   array['Step one foot back and lower until both knees are bent.',
         'Keep the front knee over the middle of the front foot.',
         'Keep the torso upright.',
         'Push through the front heel to return. Finish one side, then switch.'],
   'Breathe in as you step back and lower, breathe out as you return.',
   array['Front knee drifting inward.', 'Leaning forward.', 'Losing balance from moving too fast.']),

  ('dumbbell-calf-raise',
   'Heel raise holding dumbbells.',
   'Stand tall holding a dumbbell in each hand at your sides, near a wall for balance.',
   array['Rise up onto the balls of the feet.',
         'Pause at the top.',
         'Lower the heels slowly.'],
   'Breathe out as you rise, breathe in as you lower.',
   array['Bouncing.', 'Leaning forward.']),

  ('shoulder-press',
   'Pressing dumbbells overhead.',
   'Stand or sit tall. Hold the dumbbells at shoulder height, palms facing forward.',
   array['Brace the stomach.',
         'Press the dumbbells up until the arms are straight overhead.',
         'Lower back to shoulder height with control.'],
   'Breathe out as you press, breathe in as you lower.',
   array['Arching the lower back.', 'Shrugging the shoulders.', 'Locking the elbows hard at the top.']),

  ('one-arm-dumbbell-row',
   'Single-arm row supported on a chair or bed.',
   'Place one hand on a chair or bed. Hinge forward with a flat back, holding a dumbbell in the other hand with the arm hanging down.',
   array['Pull the dumbbell up towards the hip, keeping the elbow close to the body.',
         'Squeeze the shoulder blade at the top.',
         'Lower with control. Finish one side, then switch.'],
   'Breathe out as you pull, breathe in as you lower.',
   array['Twisting the torso.', 'Rounding the back.', 'Jerking the weight up.']),

  ('bicep-curl',
   'Standing dumbbell curl.',
   'Stand tall holding a dumbbell in each hand at your sides, palms facing forward.',
   array['Keep the elbows close to the body.',
         'Curl the dumbbells up towards the shoulders.',
         'Lower slowly to straight arms.'],
   'Breathe out as you curl, breathe in as you lower.',
   array['Swinging the body.', 'Elbows moving forward.', 'Dropping the weights quickly.']),

  ('lateral-raise',
   'Raising dumbbells out to the sides.',
   'Stand tall holding the dumbbells at your sides with a slight bend in the elbows.',
   array['Raise the arms out to the sides.',
         'Stop at shoulder height or lower.',
         'Lower slowly.',
         'Use no weight if 3 kg is too heavy to control.'],
   'Breathe out as you raise, breathe in as you lower.',
   array['Shrugging the shoulders.', 'Swinging the weights.', 'Raising above shoulder height.']),

  ('overhead-triceps-extension',
   'Overhead elbow extension holding one dumbbell.',
   'Stand or sit tall. Hold one dumbbell with both hands above your head, arms straight.',
   array['Keep the upper arms close to the head.',
         'Bend the elbows to lower the dumbbell behind the head.',
         'Straighten the arms to lift it back up.'],
   'Breathe in as you lower, breathe out as you lift.',
   array['Elbows flaring out wide.', 'Arching the lower back.', 'Lowering too fast.']),

  ('dumbbell-romanian-deadlift',
   'Hip hinge holding dumbbells.',
   'Stand with feet hip-width apart, holding the dumbbells in front of the thighs.',
   array['Keep a soft bend in the knees.',
         'Push the hips back and slide the dumbbells down the front of the legs.',
         'Keep the back flat; stop when you feel a stretch in the back of the legs or the back starts to round.',
         'Squeeze the glutes and drive the hips forward to stand up.'],
   'Breathe in as you lower, breathe out as you stand up.',
   array['Rounding the back.', 'Bending the knees into a squat.', 'Letting the dumbbells drift away from the legs.']),

  ('bent-over-row',
   'Two-arm row in a hip-hinge position.',
   'Hold a dumbbell in each hand. Hinge forward at the hips with a flat back and slightly bent knees.',
   array['Pull the dumbbells up towards the lower ribs.',
         'Squeeze the shoulder blades together.',
         'Lower with control.'],
   'Breathe out as you pull, breathe in as you lower.',
   array['Rounding the back.', 'Standing up during the pull.', 'Using momentum.']),

  ('dumbbell-sumo-squat',
   'Wide-stance squat holding one dumbbell.',
   'Stand with feet wider than shoulder-width, toes turned out, holding one dumbbell with both hands in front of the hips.',
   array['Lower the hips straight down, letting the dumbbell hang.',
         'Keep the knees pointing in the same direction as the toes.',
         'Keep the chest up.',
         'Press through the heels to stand up.'],
   'Breathe in as you lower, breathe out as you stand up.',
   array['Knees caving inward.', 'Leaning forward.', 'Heels lifting.'])
) as v(id, description, starting_position, execution_steps, breathing, common_mistakes)
where e.id = v.id;

-- Fail if any exercise was not updated (e.g. a slug typo).
do $$
declare
  missing text;
begin
  select string_agg(id, ', ') into missing
  from public.exercise_library
  where description is null or cardinality(execution_steps) = 0;
  if missing is not null then
    raise exception 'Exercises without instructions: %', missing;
  end if;
end;
$$;

commit;
