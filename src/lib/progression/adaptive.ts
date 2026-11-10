/**
 * RECOMP adaptive progression — pure, conservative, explainable.
 *
 * After a COMPLETED workout the user rates it Too Easy / Just Right / Too Hard.
 * At most ONE exercise changes, and only ONE variable (target or sets):
 *
 *  Too Easy  → among exercises fully completed in this workout (least recently
 *              adjusted first): raise the target by the exercise's step, up to
 *              its ceiling; at the ceiling add one set (if allowed). Never with
 *              pain reported. Never adds weight.
 *  Just Right → no change.
 *  Too Hard  → the performed exercise with the lowest completion (compound
 *              first on ties): remove an extra set the user had added; else
 *              lower the target by one step down to its floor; at the floor
 *              drop one set (never below 1).
 *
 * Step sizes and limits are exercise metadata (exercise_library:
 * movement_type, progression_step, progression_headroom, regression_room,
 * max_extra_sets). Unilateral targets are per side, so both sides change
 * together; timed holds (plank) change seconds, never reps.
 *
 * The database function save_workout_feedback re-validates every rule, and
 * start_workout_session applies the same bounds when it snapshots the next
 * workout. Keep `bounds()` in sync with both.
 */

export type Difficulty = "too_easy" | "just_right" | "too_hard";
export type MovementType = "compound" | "isolation" | "core" | "mobility";
export type ChangeType = "increase_target" | "decrease_target" | "increase_sets" | "decrease_sets";

export type ProgressionMeta = {
  movementType: MovementType;
  /** Reps (per side) or seconds per change. 0 = never adjusted. */
  step: number;
  headroom: number;
  regressionRoom: number;
  maxExtraSets: number;
};

export type ExerciseOutcome = {
  exerciseId: string;
  name: string;
  order: number;
  measureType: "reps" | "seconds";
  sideMode: "none" | "per_side" | "per_direction";
  status: "pending" | "in_progress" | "completed" | "partial" | "skipped";
  prescribedSets: number;
  prescribedTarget: number;
  /** The program's base prescription for this day (before any adjustment). */
  base: { sets: number; targetMin: number; targetMax: number };
  meta: ProgressionMeta;
  rows: { achieved: number; status: "completed" | "partial" | "skipped" }[];
  /** Last adjustment of this exercise for this workout type (ISO), if any. */
  lastAdjustedAt: string | null;
};

export type Adjustment = {
  exerciseId: string;
  exerciseName: string;
  changeType: ChangeType;
  previousSets: number;
  previousTarget: number;
  newSets: number;
  newTarget: number;
  reason: string;
};

export type Decision = { adjustment: Adjustment | null; message: string };

export const MAX_SETS = 4;
const MIN_REPS = 4;
const MIN_SECONDS = 10;

/** Safe range for an exercise on a given program day. */
export function bounds(e: Pick<ExerciseOutcome, "measureType" | "base" | "meta">) {
  const minAbs = e.measureType === "seconds" ? MIN_SECONDS : MIN_REPS;
  return {
    floor: Math.min(e.base.targetMin, Math.max(e.base.targetMin - e.meta.regressionRoom, minAbs)),
    ceiling: Math.max(e.base.targetMax, e.base.targetMin + e.meta.headroom),
    maxSets: Math.max(Math.min(e.base.sets + e.meta.maxExtraSets, MAX_SETS), e.base.sets),
  };
}

export function unitLabel(e: Pick<ExerciseOutcome, "measureType" | "sideMode">, n: number): string {
  if (e.measureType === "seconds") return `${n} s`;
  const side = e.sideMode === "per_side" ? " per side" : e.sideMode === "per_direction" ? " each direction" : "";
  return `${n} reps${side}`;
}

const MOVEMENT_ORDER: Record<MovementType, number> = { compound: 0, isolation: 1, core: 2, mobility: 3 };

function adjustable(e: ExerciseOutcome): boolean {
  return e.meta.step > 0 && e.meta.movementType !== "mobility";
}

function performed(e: ExerciseOutcome): boolean {
  return e.status !== "skipped" && e.status !== "pending" && e.rows.some((r) => r.status !== "skipped");
}

/** Share of the prescribed work actually done (0…1); skipped/missing sets count as 0. */
export function completionRatio(e: ExerciseOutcome): number {
  const sides = e.sideMode === "none" ? 1 : 2;
  const expected = e.prescribedSets * sides * e.prescribedTarget;
  if (expected <= 0) return 1;
  const done = e.rows.reduce((n, r) => n + (r.status === "skipped" ? 0 : Math.min(r.achieved, e.prescribedTarget)), 0);
  return Math.min(1, done / expected);
}

type Change = Omit<Adjustment, "reason" | "exerciseName" | "exerciseId">;

export function increaseFor(e: ExerciseOutcome): Change | null {
  const { ceiling, maxSets } = bounds(e);
  const sets = e.prescribedSets;
  const target = e.prescribedTarget;
  if (target < ceiling) {
    return { changeType: "increase_target", previousSets: sets, previousTarget: target, newSets: sets, newTarget: Math.min(target + e.meta.step, ceiling) };
  }
  if (sets < maxSets) {
    return { changeType: "increase_sets", previousSets: sets, previousTarget: target, newSets: sets + 1, newTarget: target };
  }
  return null;
}

export function decreaseFor(e: ExerciseOutcome): Change | null {
  const { floor } = bounds(e);
  const sets = e.prescribedSets;
  const target = e.prescribedTarget;
  // Undo an extra set first: it is the most recent added load.
  if (sets > e.base.sets) {
    return { changeType: "decrease_sets", previousSets: sets, previousTarget: target, newSets: sets - 1, newTarget: target };
  }
  if (target > floor) {
    return { changeType: "decrease_target", previousSets: sets, previousTarget: target, newSets: sets, newTarget: Math.max(target - e.meta.step, floor) };
  }
  if (sets > 1) {
    return { changeType: "decrease_sets", previousSets: sets, previousTarget: target, newSets: sets - 1, newTarget: target };
  }
  return null;
}

function easyReason(e: ExerciseOutcome, c: Change): string {
  if (c.changeType === "increase_target") {
    return `You rated this workout Too Easy and completed every set of ${e.name}. Next time: ${unitLabel(e, c.previousTarget)} → ${unitLabel(e, c.newTarget)}, one small step. Weight stays the same.`;
  }
  return `You rated this workout Too Easy and completed every set of ${e.name}, which is already at the top of its range (${unitLabel(e, c.previousTarget)}). Next time: ${c.previousSets} → ${c.newSets} sets. Weight stays the same.`;
}

function hardReason(e: ExerciseOutcome, c: Change): string {
  const pct = Math.round(completionRatio(e) * 100);
  const why = `You rated this workout Too Hard. ${e.name} was the most demanding (${pct}% of the target done)`;
  if (c.changeType === "decrease_target") {
    return `${why}, so next time it eases from ${unitLabel(e, c.previousTarget)} to ${unitLabel(e, c.newTarget)}. Good form matters more than numbers — you can build back up.`;
  }
  if (c.previousSets > e.base.sets) {
    return `${why}, so the extra set comes off: ${c.previousSets} → ${c.newSets} sets. Good form matters more than numbers.`;
  }
  return `${why} and is already at its lowest target, so next time it has one set less: ${c.previousSets} → ${c.newSets} sets. Good form matters more than numbers.`;
}

/** Short "what changes" line, e.g. "12 reps → 14 reps" or "2 → 3 sets". */
export function describeChange(a: {
  changeType: ChangeType;
  previousSets: number;
  previousTarget: number;
  newSets: number;
  newTarget: number;
  measureType: "reps" | "seconds";
  sideMode: "none" | "per_side" | "per_direction";
}): string {
  if (a.changeType === "increase_sets" || a.changeType === "decrease_sets") {
    return `${a.previousSets} → ${a.newSets} sets (${unitLabel(a, a.newTarget)})`;
  }
  return `${unitLabel(a, a.previousTarget)} → ${unitLabel(a, a.newTarget)} (${a.newSets} sets)`;
}

export const PAIN_NOTE =
  "You reported pain or unusual symptoms: nothing will be increased. Rest, and check with a health professional if it continues.";

export function decideAdjustment(input: { difficulty: Difficulty; painReported: boolean; exercises: ExerciseOutcome[] }): Decision {
  const { difficulty, painReported } = input;
  const exercises = input.exercises.filter(adjustable);

  if (difficulty === "just_right") {
    return { adjustment: null, message: painReported ? PAIN_NOTE : "Your targets stay the same — this level suits you right now." };
  }

  if (difficulty === "too_easy") {
    if (painReported) return { adjustment: null, message: PAIN_NOTE };
    const candidates = exercises
      .filter((e) => e.status === "completed")
      .sort((a, b) => (a.lastAdjustedAt ?? "").localeCompare(b.lastAdjustedAt ?? "") || a.order - b.order);
    for (const e of candidates) {
      const c = increaseFor(e);
      if (c) {
        const adjustment = { exerciseId: e.exerciseId, exerciseName: e.name, ...c, reason: easyReason(e, c) };
        return { adjustment, message: adjustment.reason };
      }
    }
    return {
      adjustment: null,
      message: "No exercise could be increased safely (each one is at its upper limit or wasn't fully completed), so your targets stay the same.",
    };
  }

  // too_hard
  const candidates = exercises
    .filter(performed)
    .sort(
      (a, b) =>
        completionRatio(a) - completionRatio(b) ||
        MOVEMENT_ORDER[a.meta.movementType] - MOVEMENT_ORDER[b.meta.movementType] ||
        a.order - b.order,
    );
  for (const e of candidates) {
    const c = decreaseFor(e);
    if (c) {
      const adjustment = { exerciseId: e.exerciseId, exerciseName: e.name, ...c, reason: hardReason(e, c) };
      return { adjustment, message: painReported ? `${adjustment.reason} ${PAIN_NOTE}` : adjustment.reason };
    }
  }
  return {
    adjustment: null,
    message: `Your targets are already at their lowest safe level, so nothing changes. Use Pause and Add 15 s whenever you need more rest.${painReported ? ` ${PAIN_NOTE}` : ""}`,
  };
}
