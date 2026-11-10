/**
 * Independent transcription of the 12-week program from the RECOMP master
 * prompt (section 8). Used by `pnpm test:db` to verify the SQL seed data.
 * Format: [exercise name, sets, targetMin, targetMax]  (targets per side; seconds for Plank)
 * Keep this file written from the master prompt, NOT copied from the seed.
 */

const W1 = {
  1: [["Bodyweight Squat", 2, 12, 12], ["Glute Bridge", 2, 15, 15], ["Reverse Lunge", 2, 10, 10], ["Donkey Kick", 2, 12, 12], ["Calf Raise", 2, 15, 15]],
  3: [["Wall Push Up", 2, 12, 12], ["Arm Circles", 2, 15, 15], ["Bird Dog", 2, 10, 10], ["Dead Bug", 2, 10, 10], ["Prone W Raise", 2, 12, 12]],
  5: [["Sumo Squat", 2, 12, 12], ["Side-Lying Leg Raise", 2, 12, 12], ["Wall Push Up", 2, 12, 12], ["Glute Bridge", 2, 15, 15], ["Standing Knee Raise", 2, 15, 15], ["Plank", 2, 15, 20]],
};

const W2_4 = {
  1: [["Goblet Squat", 2, 12, 12], ["Dumbbell Glute Bridge", 2, 15, 15], ["Dumbbell Reverse Lunge", 2, 10, 10], ["Donkey Kick", 2, 15, 15], ["Dumbbell Calf Raise", 2, 15, 15]],
  3: [["Shoulder Press", 2, 10, 10], ["One-Arm Dumbbell Row", 2, 12, 12], ["Bicep Curl", 2, 12, 12], ["Lateral Raise", 2, 10, 10], ["Overhead Triceps Extension", 2, 12, 12], ["Dead Bug", 2, 10, 10]],
  5: [["Sumo Squat", 2, 12, 12], ["Dumbbell Romanian Deadlift", 2, 12, 12], ["Bent-Over Row", 2, 12, 12], ["Side-Lying Leg Raise", 2, 15, 15], ["Dumbbell Glute Bridge", 2, 15, 15], ["Plank", 2, 20, 20]],
};

const W5_8 = {
  1: [["Goblet Squat", 3, 12, 15], ["Dumbbell Glute Bridge", 3, 15, 15], ["Dumbbell Reverse Lunge", 3, 10, 10], ["Donkey Kick", 2, 15, 15], ["Dumbbell Calf Raise", 3, 15, 15]],
  3: [["Shoulder Press", 3, 10, 12], ["One-Arm Dumbbell Row", 3, 12, 12], ["Bicep Curl", 2, 12, 12], ["Lateral Raise", 2, 12, 12], ["Overhead Triceps Extension", 2, 12, 12], ["Dead Bug", 3, 10, 10]],
  5: [["Dumbbell Sumo Squat", 3, 12, 15], ["Dumbbell Romanian Deadlift", 3, 12, 12], ["Bent-Over Row", 3, 12, 12], ["Side-Lying Leg Raise", 2, 15, 15], ["Dumbbell Glute Bridge", 3, 15, 15], ["Plank", 3, 20, 30]],
};

const W9_12 = {
  1: [["Goblet Squat", 3, 15, 15], ["Dumbbell Glute Bridge", 3, 15, 15], ["Dumbbell Reverse Lunge", 3, 12, 12], ["Donkey Kick", 3, 15, 15], ["Dumbbell Calf Raise", 3, 15, 15]],
  3: [["Shoulder Press", 3, 10, 12], ["One-Arm Dumbbell Row", 3, 12, 12], ["Bicep Curl", 3, 12, 12], ["Lateral Raise", 2, 12, 12], ["Overhead Triceps Extension", 3, 12, 12], ["Dead Bug", 3, 12, 12]],
  5: [["Dumbbell Sumo Squat", 3, 15, 15], ["Dumbbell Romanian Deadlift", 3, 15, 15], ["Bent-Over Row", 3, 12, 12], ["Side-Lying Leg Raise", 3, 15, 15], ["Dumbbell Glute Bridge", 3, 15, 15], ["Plank", 3, 30, 30]],
};

export function strengthDaysForWeek(week) {
  if (week === 1) return W1;
  if (week <= 4) return W2_4;
  if (week <= 8) return W5_8;
  return W9_12;
}

/** Walking minutes [min, max] for Tuesday (2) and Saturday (6). */
export function walkingForWeek(week) {
  if (week === 1) return { 2: [20, 20], 6: [20, 20] };
  if (week <= 4) return { 2: [20, 25], 6: [20, 25] };
  if (week <= 8) return { 2: [25, 25], 6: [30, 30] };
  return { 2: [30, 30], 6: [30, 30] };
}

/** Tempos stated explicitly in the master prompt (Week 1 Monday). */
export const SPEC_TEMPOS = {
  "Bodyweight Squat": [3, 1, 1],
  "Glute Bridge": [2, 1, 2],
  "Reverse Lunge": [2, 1, 2],
  "Donkey Kick": [2, 1, 2],
  "Calf Raise": [1, 1, 2],
};

export const SCHEDULE = ["lower_body", "walking", "upper_body_core", "recovery", "full_body_core", "walking", "rest"];

/** Exercises performed per side / per direction in the master prompt. */
export const UNILATERAL = [
  "Reverse Lunge", "Donkey Kick", "Bird Dog", "Dead Bug", "Side-Lying Leg Raise", "Standing Knee Raise",
  "Dumbbell Reverse Lunge", "One-Arm Dumbbell Row",
];
export const PER_DIRECTION = ["Arm Circles"];
