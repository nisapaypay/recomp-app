/**
 * RECOMP workout engine — a pure, timestamp-based state machine.
 *
 * - No timers inside: every function receives `now` (ms since epoch) and
 *   derives remaining time from stored timestamps (`phaseEndsAt`). The UI
 *   calls `reduce(state, { type: "tick" }, Date.now())` from ONE interval;
 *   missed or throttled ticks are caught up from the timestamps, so the
 *   timer stays correct in background tabs and never runs twice.
 * - Flow: ONE 10 s preparation countdown when the workout begins, then
 *   set → rest → set … ; after an exercise's last set a 60 s transition rest
 *   (the engine already points at the NEXT exercise, set 1, so the UI can
 *   preview it) → next exercise set 1. No countdown between sets, sides or
 *   exercises; no rest after the very last set.
 * - Reps are counted automatically: every completed tempo cycle is one rep
 *   and the set finishes at the target. "rep_done" adds a rep immediately
 *   (and restarts the cycle), "rep_undo" corrects, "finish_side" ends early.
 *   Exercises without a tempo are counted only by "rep_done".
 * - Timed holds (plank) finish when their countdown reaches zero.
 * - Unilateral exercises: left then right (or forward then backward) form
 *   one set, with no rest in between; each side is recorded separately and
 *   the rest starts only after both sides.
 * - If the device sleeps (a gap between ticks longer than
 *   SUSPEND_THRESHOLD_MS) the workout is paused at the last tick, so time
 *   spent asleep is never counted as exercise and no hold is auto-completed.
 *
 * Side effects are returned as `effects` for the caller to run
 * (persist a set, play a sound, save a checkpoint).
 *
 * Imports use .ts extensions so the module runs under plain Node in tests.
 */
import type { Tempo } from "../program/estimate.ts";

export const PREPARE_MS = 10_000;
export const ADD_REST_MS = 15_000;
/** Rest between the last set of one exercise and the first set of the next. */
export const TRANSITION_REST_MS = 60_000;
/** Longer than browsers' background-tab timer throttling (≤ 60 s). */
export const SUSPEND_THRESHOLD_MS = 90_000;

export type MeasureType = "reps" | "seconds";
export type SideMode = "none" | "per_side" | "per_direction";
export type Side = "left" | "right" | "forward" | "backward";
export type TempoStart = "eccentric" | "concentric";

export type EngineExercise = {
  order: number;
  name: string;
  measureType: MeasureType;
  sideMode: SideMode;
  sets: number;
  /** Reps (per side) or seconds for timed holds. */
  target: number;
  tempo: Tempo | null;
  /** Which tempo phase the movement starts with (squat: eccentric; curl: concentric). */
  tempoStart: TempoStart;
  restSeconds: number;
};

export type PhaseKind = "intro" | "prepare" | "work" | "rest" | "complete";
export type PauseReason = "user" | "suspended" | "recovered";

export type EngineState = {
  exercises: EngineExercise[];
  exerciseIndex: number;
  /** 1-based. During rest this is already the NEXT set. */
  setNumber: number;
  side: Side | null;
  phase: PhaseKind;
  /** Start of the current phase (work: start of this side/set). */
  phaseStartedAt: number | null;
  /** End of a timed phase (prepare, rest, timed hold). */
  phaseEndsAt: number | null;
  /** Rep work: start of the current tempo cycle (reset on every confirmed rep). */
  tempoAnchorAt: number | null;
  /** Reps confirmed by the user in the current side/set. */
  reps: number;
  paused: boolean;
  pausedAt: number | null;
  pauseReason: PauseReason | null;
  /** Remaining time of a timed phase while paused. */
  remainingMs: number | null;
  pausedMsTotal: number;
  /** Paused time inside the current work phase (for set duration). */
  workPausedMs: number;
  lastTickAt: number | null;
};

export type SoundCue = "countdown" | "go" | "tempo" | "rep" | "rest_complete" | "transition" | "workout_complete";

/** Most important first: when several cues fall on the same moment, only the top one plays. */
const CUE_PRIORITY: readonly SoundCue[] = ["workout_complete", "transition", "rest_complete", "go", "countdown", "rep", "tempo"];

/** At most ONE sound per engine step, so cues never pile up on each other. */
export function pickCue(effects: readonly EngineEffect[]): SoundCue | null {
  let best: SoundCue | null = null;
  for (const e of effects) {
    if (e.type !== "sound") continue;
    if (best === null || CUE_PRIORITY.indexOf(e.cue) < CUE_PRIORITY.indexOf(best)) best = e.cue;
  }
  return best;
}

export type SetResult = {
  exerciseOrder: number;
  setNumber: number;
  side: Side | null;
  target: number;
  achieved: number;
  status: "completed" | "partial" | "skipped";
  durationSeconds: number | null;
};

export type EngineEffect =
  | { type: "began" }
  | { type: "record_set"; result: SetResult }
  | { type: "skip_exercise"; exerciseOrder: number }
  | { type: "sound"; cue: SoundCue }
  | { type: "checkpoint" }
  | { type: "finished" };

export type EngineAction =
  | { type: "begin" }
  | { type: "tick" }
  | { type: "skip_prepare" }
  | { type: "rep_done" }
  | { type: "rep_undo" }
  | { type: "finish_side" }
  | { type: "skip_rest" }
  | { type: "add_rest" }
  | { type: "skip_exercise" }
  | { type: "pause"; reason?: PauseReason }
  | { type: "resume" }
  | { type: "set_tempo"; tempo: Tempo };

export type EngineResult = { state: EngineState; effects: EngineEffect[] };

// ---------------------------------------------------------------------------
// Construction & helpers
// ---------------------------------------------------------------------------

export function createInitialState(exercises: EngineExercise[]): EngineState {
  return {
    exercises,
    exerciseIndex: 0,
    setNumber: 1,
    side: exercises[0] ? firstSide(exercises[0].sideMode) : null,
    phase: "intro",
    phaseStartedAt: null,
    phaseEndsAt: null,
    tempoAnchorAt: null,
    reps: 0,
    paused: false,
    pausedAt: null,
    pauseReason: null,
    remainingMs: null,
    pausedMsTotal: 0,
    workPausedMs: 0,
    lastTickAt: null,
  };
}

export function firstSide(mode: SideMode): Side | null {
  if (mode === "per_side") return "left";
  if (mode === "per_direction") return "forward";
  return null;
}

export function secondSide(side: Side | null): Side | null {
  if (side === "left") return "right";
  if (side === "forward") return "backward";
  return null;
}

export function currentExercise(state: EngineState): EngineExercise | undefined {
  return state.exercises[state.exerciseIndex];
}

/** Remaining ms of the current timed phase (null for rep work / intro / complete). */
export function remainingMs(state: EngineState, now: number): number | null {
  if (state.paused) return state.remainingMs;
  if (state.phaseEndsAt === null) return null;
  return Math.max(0, state.phaseEndsAt - now);
}

/**
 * What the current rest leads into. During a transition the engine already
 * points at the next exercise (set 1); between sets setNumber is ≥ 2.
 */
export function restKind(state: EngineState): "between_sets" | "transition" | null {
  if (state.phase !== "rest") return null;
  return state.setNumber === 1 ? "transition" : "between_sets";
}

export function isTimedHold(state: EngineState): boolean {
  return state.phase === "work" && currentExercise(state)?.measureType === "seconds";
}

// ---------------------------------------------------------------------------
// Tempo guide
// ---------------------------------------------------------------------------

export type TempoPhaseName = "eccentric" | "hold" | "concentric";
export type TempoStep = { name: TempoPhaseName; ms: number };

/** Ordered tempo phases, skipping zero-length ones (e.g. arm circles 1-0-1). */
export function tempoSequence(tempo: Tempo, start: TempoStart): TempoStep[] {
  const ecc = { name: "eccentric" as const, ms: tempo.eccentric * 1000 };
  const hold = { name: "hold" as const, ms: tempo.pause * 1000 };
  const con = { name: "concentric" as const, ms: tempo.concentric * 1000 };
  const order = start === "eccentric" ? [ecc, hold, con] : [con, hold, ecc];
  return order.filter((s) => s.ms > 0);
}

export type TempoPosition = {
  step: TempoStep;
  index: number;
  stepRemainingMs: number;
  cycleMs: number;
  /** 0…1 progress through the whole rep cycle. */
  cycleProgress: number;
};

/** Where in the (repeating) tempo cycle we are at `at`. */
export function tempoPositionAt(
  tempo: Tempo | null,
  start: TempoStart,
  anchor: number | null,
  at: number,
): TempoPosition | null {
  if (!tempo || anchor === null) return null;
  const steps = tempoSequence(tempo, start);
  const cycleMs = steps.reduce((sum, s) => sum + s.ms, 0);
  if (cycleMs === 0) return null;
  const t = (((at - anchor) % cycleMs) + cycleMs) % cycleMs;
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    if (t < acc + steps[i].ms) {
      return { step: steps[i], index: i, stepRemainingMs: acc + steps[i].ms - t, cycleMs, cycleProgress: t / cycleMs };
    }
    acc += steps[i].ms;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Transitions (mutate a draft copy; reduce() always copies first)
// ---------------------------------------------------------------------------

function startPrepare(s: EngineState, at: number) {
  s.phase = "prepare";
  s.phaseStartedAt = at;
  s.phaseEndsAt = at + PREPARE_MS;
  s.tempoAnchorAt = null;
  s.reps = 0;
  s.workPausedMs = 0;
}

function startRest(s: EngineState, at: number, durationMs: number) {
  s.phase = "rest";
  s.phaseStartedAt = at;
  s.phaseEndsAt = at + durationMs;
  s.tempoAnchorAt = null;
  s.reps = 0;
  s.workPausedMs = 0;
}

function startWork(s: EngineState, at: number, fx: EngineEffect[], cue: SoundCue = "go") {
  const ex = currentExercise(s);
  if (!ex) return;
  s.phase = "work";
  s.phaseStartedAt = at;
  s.workPausedMs = 0;
  s.reps = 0;
  if (ex.measureType === "seconds") {
    s.phaseEndsAt = at + ex.target * 1000;
    s.tempoAnchorAt = null;
  } else {
    s.phaseEndsAt = null;
    s.tempoAnchorAt = at;
  }
  fx.push({ type: "sound", cue }, { type: "checkpoint" });
}

function nextExercise(s: EngineState, at: number, fx: EngineEffect[]) {
  if (s.exerciseIndex + 1 < s.exercises.length) {
    s.exerciseIndex += 1;
    s.setNumber = 1;
    s.side = firstSide(s.exercises[s.exerciseIndex].sideMode);
    // Transition rest: the next exercise is previewed while resting.
    startRest(s, at, TRANSITION_REST_MS);
    fx.push({ type: "sound", cue: "transition" }, { type: "checkpoint" });
  } else {
    s.phase = "complete";
    s.phaseStartedAt = at;
    s.phaseEndsAt = null;
    s.tempoAnchorAt = null;
    s.reps = 0;
    fx.push({ type: "sound", cue: "workout_complete" }, { type: "checkpoint" }, { type: "finished" });
  }
}

function finishSide(s: EngineState, at: number, achieved: number, fx: EngineEffect[]) {
  const ex = currentExercise(s);
  if (!ex || s.phase !== "work" || s.phaseStartedAt === null) return;
  const clamped = Math.max(0, Math.min(achieved, ex.target));
  const status: SetResult["status"] = clamped >= ex.target ? "completed" : clamped > 0 ? "partial" : "skipped";
  const durationMs = Math.max(0, at - s.phaseStartedAt - s.workPausedMs);
  fx.push({
    type: "record_set",
    result: {
      exerciseOrder: ex.order,
      setNumber: s.setNumber,
      side: s.side,
      target: ex.target,
      achieved: clamped,
      status,
      durationSeconds: Math.round(durationMs / 1000),
    },
  });

  const other = secondSide(s.side);
  if (other) {
    // First side done → straight to the other side (same set, no rest).
    s.side = other;
    startWork(s, at, fx);
    return;
  }

  if (s.setNumber < ex.sets) {
    s.setNumber += 1;
    s.side = firstSide(ex.sideMode);
    if (ex.restSeconds > 0) {
      startRest(s, at, ex.restSeconds * 1000);
      fx.push({ type: "checkpoint" });
    } else {
      startWork(s, at, fx);
    }
    return;
  }

  nextExercise(s, at, fx);
}

function pauseAt(s: EngineState, at: number, reason: PauseReason) {
  s.paused = true;
  s.pausedAt = at;
  s.pauseReason = reason;
  s.remainingMs = s.phaseEndsAt === null ? null : Math.max(0, s.phaseEndsAt - at);
}

function resumeAt(s: EngineState, now: number) {
  const pausedFor = Math.max(0, now - (s.pausedAt ?? now));
  s.pausedMsTotal += pausedFor;
  if (s.phase === "work") s.workPausedMs += pausedFor;
  if (s.remainingMs !== null) s.phaseEndsAt = now + s.remainingMs;
  if (s.phase === "work" && currentExercise(s)?.measureType === "reps") {
    s.tempoAnchorAt = s.tempoAnchorAt === null ? now : s.tempoAnchorAt + pausedFor;
  }
  s.paused = false;
  s.pausedAt = null;
  s.pauseReason = null;
  s.remainingMs = null;
}

function countdownCrossed(endsAt: number, prev: number, now: number): boolean {
  const before = endsAt - prev;
  const after = endsAt - now;
  return [3000, 2000, 1000].some((k) => before > k && after <= k);
}

/**
 * Each completed tempo cycle counts one rep. The anchor moves by whole cycles,
 * so the tempo guide keeps its position; throttled ticks catch up exactly and
 * the set finishes at the moment the last rep's cycle ended.
 */
function autoCountReps(s: EngineState, now: number, fx: EngineEffect[]) {
  const ex = currentExercise(s);
  if (!ex || ex.measureType !== "reps" || !ex.tempo || s.tempoAnchorAt === null) return;
  const cycleMs = tempoSequence(ex.tempo, ex.tempoStart).reduce((sum, step) => sum + step.ms, 0);
  if (cycleMs <= 0) return;
  const cycles = Math.floor((now - s.tempoAnchorAt) / cycleMs);
  if (cycles <= 0) return;
  const needed = ex.target - s.reps;
  fx.push({ type: "sound", cue: "rep" });
  if (cycles >= needed) {
    const at = s.tempoAnchorAt + needed * cycleMs;
    s.reps = ex.target;
    finishSide(s, at, s.reps, fx);
    return;
  }
  s.reps += cycles;
  s.tempoAnchorAt += cycles * cycleMs;
  fx.push({ type: "checkpoint" });
}

function tick(s: EngineState, now: number, fx: EngineEffect[]) {
  const active = s.phase === "prepare" || s.phase === "work" || s.phase === "rest";
  if (!active || s.paused) {
    s.lastTickAt = now;
    return;
  }

  // Device was asleep (or the page frozen): pause where we left off.
  if (s.lastTickAt !== null && now - s.lastTickAt > SUSPEND_THRESHOLD_MS) {
    pauseAt(s, s.lastTickAt, "suspended");
    s.lastTickAt = now;
    fx.push({ type: "checkpoint" });
    return;
  }

  const prev = s.lastTickAt ?? now;
  const phaseBefore = s.phase;
  const tempoBefore =
    s.phase === "work" && s.tempoAnchorAt !== null
      ? tempoPositionAt(currentExercise(s)?.tempo ?? null, currentExercise(s)?.tempoStart ?? "eccentric", s.tempoAnchorAt, prev)
      : null;

  // Catch up on every phase that ended since the last tick (throttled tabs).
  for (let guard = 0; guard < 50; guard++) {
    if (s.phaseEndsAt === null || s.phaseEndsAt > now) break;
    const endedAt = s.phaseEndsAt;
    if (s.phase === "prepare") {
      startWork(s, endedAt, fx);
    } else if (s.phase === "rest") {
      // Rest over → straight into the next set (no preparation countdown).
      startWork(s, endedAt, fx, "rest_complete");
    } else if (s.phase === "work") {
      // Timed hold reached its target.
      finishSide(s, endedAt, currentExercise(s)?.target ?? 0, fx);
    } else {
      break;
    }
  }

  if (s.phase === "work") autoCountReps(s, now, fx);

  if (s.phase === phaseBefore && s.phaseEndsAt !== null && (s.phase === "prepare" || s.phase === "rest" || isTimedHold(s))) {
    if (countdownCrossed(s.phaseEndsAt, prev, now)) fx.push({ type: "sound", cue: "countdown" });
  }

  if (s.phase === "work" && phaseBefore === "work" && tempoBefore) {
    const ex = currentExercise(s);
    const tempoNow = tempoPositionAt(ex?.tempo ?? null, ex?.tempoStart ?? "eccentric", s.tempoAnchorAt, now);
    if (tempoNow && tempoNow.index !== tempoBefore.index) fx.push({ type: "sound", cue: "tempo" });
  }

  s.lastTickAt = now;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(state: EngineState, action: EngineAction, now: number): EngineResult {
  const s: EngineState = { ...state };
  const fx: EngineEffect[] = [];
  const ex = currentExercise(s);

  switch (action.type) {
    case "begin":
      if (s.phase === "intro" && ex) {
        s.exerciseIndex = 0;
        s.setNumber = 1;
        s.side = firstSide(ex.sideMode);
        startPrepare(s, now);
        s.lastTickAt = now;
        fx.push({ type: "began" }, { type: "checkpoint" });
      }
      break;

    case "tick":
      tick(s, now, fx);
      break;

    case "skip_prepare":
      if (s.phase === "prepare" && !s.paused) startWork(s, now, fx);
      break;

    case "rep_done":
      if (s.phase === "work" && !s.paused && ex?.measureType === "reps") {
        s.reps += 1;
        s.tempoAnchorAt = now;
        fx.push({ type: "sound", cue: "rep" });
        if (s.reps >= ex.target) finishSide(s, now, s.reps, fx);
        else fx.push({ type: "checkpoint" });
      }
      break;

    case "rep_undo":
      if (s.phase === "work" && !s.paused && s.reps > 0) {
        s.reps -= 1;
        fx.push({ type: "checkpoint" });
      }
      break;

    case "finish_side":
      if (s.phase === "work" && !s.paused && ex && s.phaseStartedAt !== null) {
        const achieved =
          ex.measureType === "reps"
            ? s.reps
            : Math.floor((now - s.phaseStartedAt - s.workPausedMs) / 1000);
        finishSide(s, now, achieved, fx);
      }
      break;

    case "skip_rest":
      if (s.phase === "rest" && !s.paused) startWork(s, now, fx);
      break;

    case "add_rest":
      if (s.phase === "rest") {
        if (s.paused && s.remainingMs !== null) s.remainingMs += ADD_REST_MS;
        else if (s.phaseEndsAt !== null) s.phaseEndsAt += ADD_REST_MS;
        fx.push({ type: "checkpoint" });
      }
      break;

    case "skip_exercise":
      if ((s.phase === "prepare" || s.phase === "work" || s.phase === "rest") && ex) {
        if (s.paused) resumeAt(s, now);
        fx.push({ type: "skip_exercise", exerciseOrder: ex.order });
        nextExercise(s, now, fx);
      }
      break;

    case "pause":
      if (!s.paused && (s.phase === "prepare" || s.phase === "work" || s.phase === "rest")) {
        pauseAt(s, now, action.reason ?? "user");
        fx.push({ type: "checkpoint" });
      }
      break;

    case "resume":
      if (s.paused) {
        resumeAt(s, now);
        // A recovered preparation restarts in full.
        if (s.phase === "prepare") s.phaseEndsAt = Math.max(s.phaseEndsAt ?? now, now);
        s.lastTickAt = now;
        fx.push({ type: "checkpoint" });
      }
      break;

    case "set_tempo":
      if (ex && ex.measureType === "reps") {
        const t = action.tempo;
        const valid = [t.eccentric, t.pause, t.concentric].every((v) => Number.isInteger(v) && v >= 0 && v <= 10);
        if (valid && t.eccentric + t.pause + t.concentric > 0) {
          s.exercises = s.exercises.map((e, i) => (i === s.exerciseIndex ? { ...e, tempo: { ...t } } : e));
          if (s.phase === "work" && !s.paused) s.tempoAnchorAt = now;
          fx.push({ type: "checkpoint" });
        }
      }
      break;
  }

  // Any user action proves the device is awake: it must never be mistaken
  // for a sleep gap on the next tick.
  if (action.type !== "tick" && s.lastTickAt !== null) s.lastTickAt = Math.max(s.lastTickAt, now);

  return { state: s, effects: fx };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** Units of work (set × side) in the whole workout, and how many are behind us. */
export function workoutProgress(state: EngineState): { done: number; total: number } {
  const units = (e: EngineExercise) => e.sets * (e.sideMode === "none" ? 1 : 2);
  const total = state.exercises.reduce((n, e) => n + units(e), 0);
  if (state.phase === "complete") return { done: total, total };
  if (state.phase === "intro") return { done: 0, total };
  const ex = currentExercise(state);
  if (!ex) return { done: total, total };
  const before = state.exercises.slice(0, state.exerciseIndex).reduce((n, e) => n + units(e), 0);
  const sidesPerSet = ex.sideMode === "none" ? 1 : 2;
  const sideOffset = state.side !== null && secondSide(state.side) === null && ex.sideMode !== "none" ? 1 : 0;
  const within = (state.setNumber - 1) * sidesPerSet + sideOffset;
  return { done: before + within, total };
}

/** Active (unpaused) seconds since `startedAt`. */
export function activeSeconds(state: EngineState, startedAt: number, now: number): number {
  const pausedNow = state.paused && state.pausedAt !== null ? now - state.pausedAt : 0;
  return Math.max(0, Math.round((now - startedAt - state.pausedMsTotal - pausedNow) / 1000));
}
