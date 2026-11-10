import type { TempoStart } from "./workout-engine.ts";

/**
 * Exercises whose movement starts with the concentric (lifting / pulling /
 * pressing) phase from the starting position, so the tempo guide shows
 * "Concentric → Hold → Eccentric". All others start with the eccentric
 * (lowering) phase, e.g. squats, lunges, push-ups, Romanian deadlifts.
 */
const CONCENTRIC_FIRST = new Set([
  "glute-bridge",
  "dumbbell-glute-bridge",
  "donkey-kick",
  "calf-raise",
  "dumbbell-calf-raise",
  "prone-w-raise",
  "side-lying-leg-raise",
  "standing-knee-raise",
  "bird-dog",
  "shoulder-press",
  "one-arm-dumbbell-row",
  "bent-over-row",
  "bicep-curl",
  "lateral-raise",
]);

export function tempoStartFor(exerciseId: string): TempoStart {
  return CONCENTRIC_FIRST.has(exerciseId) ? "concentric" : "eccentric";
}
