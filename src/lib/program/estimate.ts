/**
 * Workout duration estimate from prescriptions (planning aid only — the real
 * duration is measured by the workout engine).
 *
 * Model (matches the workout engine flow):
 *   one 10 s preparation countdown at the start of the workout
 *   per side, per set: work
 *     work = reps × (eccentric + pause + concentric)   for rep-based exercises
 *     work = seconds                                   for timed holds
 *   unilateral / per-direction exercises do every set on both sides (no rest between sides)
 *   rest between sets of an exercise (its prescribed rest)
 *   60 s transition rest between exercises; nothing after the last set
 */

export const PREPARATION_SECONDS = 10;
export const TRANSITION_REST_SECONDS = 60;

export type Tempo = { eccentric: number; pause: number; concentric: number };

export type EstimateInput = {
  sets: number;
  target: number;
  measureType: "reps" | "seconds";
  sideMode: "none" | "per_side" | "per_direction";
  tempo: Tempo | null;
  restSeconds: number;
};

export function tempoSeconds(tempo: Tempo | null): number {
  return tempo ? tempo.eccentric + tempo.pause + tempo.concentric : 0;
}

export function estimateExerciseSeconds(input: EstimateInput): number {
  const sides = input.sideMode === "none" ? 1 : 2;
  const work =
    input.measureType === "seconds"
      ? input.target
      : input.target * Math.max(tempoSeconds(input.tempo), 1);
  const perSet = sides * work;
  return input.sets * perSet + Math.max(input.sets - 1, 0) * input.restSeconds;
}

export function estimateWorkoutSeconds(exercises: EstimateInput[]): number {
  if (exercises.length === 0) return 0;
  const work = exercises.reduce((sum, e) => sum + estimateExerciseSeconds(e), 0);
  return PREPARATION_SECONDS + work + (exercises.length - 1) * TRANSITION_REST_SECONDS;
}

/** Rounded up to whole minutes for display. */
export function toMinutes(seconds: number): number {
  return Math.ceil(seconds / 60);
}
