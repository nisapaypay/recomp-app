/**
 * Where the exercise animation should be, derived ONLY from the workout
 * engine's state (no timer, no state of its own).
 *
 * - Reps: the position comes from the engine's tempo anchor and tempo
 *   sequence, exactly the numbers `autoCountReps` uses, so one animation
 *   cycle is one counted rep and the two can never drift apart.
 * - Timed holds: progress comes from the hold's remaining time; the figure
 *   only "breathes" (no repetition cycle).
 * - Rest / preparation: a PREVIEW of the coming exercise at its tempo,
 *   anchored on the engine's `phaseStartedAt` (still no timer; nothing is
 *   counted — reps are only counted during work).
 * - Paused: time is frozen at `pausedAt` → the figure freezes; on resume the
 *   engine shifts the anchor by the paused time → the figure continues from
 *   the same position.
 * - After a sleep / frozen page (gap since the last tick longer than the
 *   engine's suspend threshold) time is held at the last tick, the moment the
 *   engine will pause at, so the figure never jumps ahead.
 *
 * Pure: never mutates the state. Imports use .ts for plain-Node tests.
 */
import {
  SUSPEND_THRESHOLD_MS,
  currentExercise,
  tempoPositionAt,
  tempoSequence,
  type EngineState,
  type Side,
  type TempoPhaseName,
} from "../engine/workout-engine.ts";

/** One slow breath while holding a position (plank). */
export const BREATH_MS = 4000;

export type MovementMode = "rep" | "hold" | "preview" | "still";

export type Movement = {
  exerciseIndex: number;
  mode: MovementMode;
  /** 0 = start position, 1 = peak position (bottom of a squat, top of a curl). */
  amount: number;
  /** 0…1 through the current rep cycle (rep mode), e.g. for arm circles. */
  cycle: number;
  /** Current tempo phase (rep mode). */
  tempoPhase: TempoPhaseName | null;
  /** 0…1 of the hold's duration (hold mode). */
  holdProgress: number;
  side: Side | null;
  /** Paused: the figure stays where it is. */
  frozen: boolean;
};

/** The moment the animation shows: the engine's own notion of "now". */
export function animationTime(state: EngineState, now: number): number {
  if (state.paused) return state.pausedAt ?? now;
  if (state.lastTickAt !== null && now - state.lastTickAt > SUSPEND_THRESHOLD_MS) return state.lastTickAt;
  return now;
}

const easeInOut = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, p)));

export function movementAt(state: EngineState, now: number, opts: { reducedMotion?: boolean } = {}): Movement | null {
  const ex = currentExercise(state);
  if (!ex || state.phase === "intro" || state.phase === "complete") return null;
  const t = animationTime(state, now);
  const base: Movement = {
    exerciseIndex: state.exerciseIndex,
    mode: "still",
    amount: 0,
    cycle: 0,
    tempoPhase: null,
    holdProgress: 0,
    side: state.side,
    frozen: state.paused,
  };

  if (state.phase !== "work") {
    // Prepare / rest: show the coming exercise moving so it's clear what's next.
    if (state.phaseStartedAt === null) return base;
    if (ex.measureType === "seconds") {
      const breath = opts.reducedMotion ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * Math.max(0, t - state.phaseStartedAt)) / BREATH_MS);
      return { ...base, mode: "preview", amount: breath };
    }
    const preview = tempoPositionAt(ex.tempo, ex.tempoStart, state.phaseStartedAt, t);
    if (!ex.tempo || !preview) return base;
    const names = tempoSequence(ex.tempo, ex.tempoStart).map((s) => s.name);
    return {
      ...base,
      mode: "preview",
      amount: amountFor(names, preview.index, 1 - preview.stepRemainingMs / preview.step.ms, opts.reducedMotion ?? false),
      cycle: preview.cycleProgress,
      tempoPhase: preview.step.name,
    };
  }

  if (ex.measureType === "seconds") {
    const totalMs = ex.target * 1000;
    const remaining = state.paused ? state.remainingMs : state.phaseEndsAt === null ? null : Math.max(0, state.phaseEndsAt - t);
    const elapsed = remaining === null ? 0 : Math.min(totalMs, Math.max(0, totalMs - remaining));
    const breath = opts.reducedMotion ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * elapsed) / BREATH_MS);
    return { ...base, mode: "hold", amount: breath, holdProgress: totalMs > 0 ? elapsed / totalMs : 0 };
  }

  const pos = tempoPositionAt(ex.tempo, ex.tempoStart, state.tempoAnchorAt, t);
  if (!ex.tempo || !pos || state.tempoAnchorAt === null) return base; // counted only by "Rep done"

  // The last rep's cycle has ended but the engine hasn't ticked yet: rest in
  // the start position instead of beginning a rep that won't happen.
  const cyclesDone = Math.floor((t - state.tempoAnchorAt) / pos.cycleMs);
  if (cyclesDone >= ex.target - state.reps) return { ...base, mode: "rep" };

  const steps = tempoSequence(ex.tempo, ex.tempoStart);
  const stepProgress = 1 - pos.stepRemainingMs / pos.step.ms;
  return {
    ...base,
    mode: "rep",
    amount: amountFor(steps.map((s) => s.name), pos.index, stepProgress, opts.reducedMotion ?? false),
    cycle: pos.cycleProgress,
    tempoPhase: pos.step.name,
  };
}

/**
 * Position inside one rep. The first moving phase goes start → peak, a hold
 * stays at the peak, the last moving phase returns to the start. A tempo with
 * a single moving phase goes out and back within it. With reduced motion the
 * figure shows the position each phase moves towards (no in-between frames).
 */
export function amountFor(steps: readonly TempoPhaseName[], index: number, p: number, reduced: boolean): number {
  const moving = steps.map((s, i) => (s === "hold" ? -1 : i)).filter((i) => i >= 0);
  const name = steps[index];
  if (moving.length === 0) return 0;
  if (moving.length === 1) {
    if (name === "hold") return 0;
    if (reduced) return 1;
    return p < 0.5 ? easeInOut(p * 2) : 1 - easeInOut(p * 2 - 1);
  }
  const first = moving[0];
  const last = moving[moving.length - 1];
  if (index <= first) return reduced ? 1 : easeInOut(index === first ? p : 0);
  if (index >= last) return reduced ? 0 : 1 - easeInOut(p);
  return 1; // hold between the moving phases
}

// ---------------------------------------------------------------------------
// Demo (exercise library covers and the interactive demo — NOT the workout)
// ---------------------------------------------------------------------------

export type DemoExercise = {
  measureType: "reps" | "seconds";
  tempo: { eccentric: number; pause: number; concentric: number } | null;
  tempoStart: "eccentric" | "concentric";
};

/** Length of one demo rep (or one breath for holds). */
export function demoCycleMs(ex: DemoExercise): number {
  if (ex.measureType === "seconds" || !ex.tempo) return BREATH_MS;
  return tempoSequence(ex.tempo, ex.tempoStart).reduce((n, s) => n + s.ms, 0) || BREATH_MS;
}

/**
 * Pose for a looping demo `elapsedMs` into the demo, with the same tempo
 * maths as the workout (one cycle = one rep). Outside a workout there is no
 * engine, so the caller supplies the elapsed time.
 */
export function demoMovement(
  ex: DemoExercise,
  elapsedMs: number,
  side: Side | null,
  reduced = false,
): Pick<Movement, "amount" | "cycle" | "tempoPhase" | "side"> & { rep: number; stepIndex: number } {
  const cycleMs = demoCycleMs(ex);
  const rep = Math.floor(Math.max(0, elapsedMs) / cycleMs) + 1;
  if (ex.measureType === "seconds" || !ex.tempo) {
    const amount = reduced ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * elapsedMs) / BREATH_MS);
    return { amount, cycle: (elapsedMs % cycleMs) / cycleMs, tempoPhase: null, side, rep, stepIndex: -1 };
  }
  const pos = tempoPositionAt(ex.tempo, ex.tempoStart, 0, elapsedMs);
  if (!pos) return { amount: 0, cycle: 0, tempoPhase: null, side, rep, stepIndex: -1 };
  const steps = tempoSequence(ex.tempo, ex.tempoStart).map((s) => s.name);
  return {
    amount: amountFor(steps, pos.index, 1 - pos.stepRemainingMs / pos.step.ms, reduced),
    cycle: pos.cycleProgress,
    tempoPhase: pos.step.name,
    side,
    rep,
    stepIndex: pos.index,
  };
}
