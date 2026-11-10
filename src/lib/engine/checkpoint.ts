/**
 * Mapping between the engine state and the workout_session_state row.
 * Pure (unit-tested). Timestamps are ISO strings in the DB, epoch ms here.
 */
import {
  PREPARE_MS,
  createInitialState,
  type EngineExercise,
  type EngineState,
  type PhaseKind,
  type Side,
} from "./workout-engine.ts";
import type { Tempo } from "../program/estimate.ts";

export type CheckpointRow = {
  current_exercise_index: number;
  current_set: number;
  current_side: Side | null;
  current_rep: number;
  current_phase: string;
  phase_started_at: string | null;
  phase_duration_ms: number | null;
  remaining_ms: number | null;
  paused: boolean;
  paused_ms_total: number;
  paused_at: string | null;
  tempo_override: Record<string, [number, number, number]> | null;
  revision: number;
  updated_at: string;
};

export type CheckpointWrite = Omit<CheckpointRow, "revision" | "updated_at">;

const PHASES: readonly PhaseKind[] = ["intro", "prepare", "work", "rest", "complete"];

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const ms = (value: string | null) => (value === null ? null : Date.parse(value));

/** Engine state → checkpoint columns. */
export function toCheckpoint(state: EngineState, original: EngineExercise[]): CheckpointWrite {
  const timed = state.phaseEndsAt !== null && state.phaseStartedAt !== null;
  const overrides: Record<string, [number, number, number]> = {};
  state.exercises.forEach((e, i) => {
    const before = original[i]?.tempo;
    const now = e.tempo;
    if (now && (!before || before.eccentric !== now.eccentric || before.pause !== now.pause || before.concentric !== now.concentric)) {
      overrides[String(e.order)] = [now.eccentric, now.pause, now.concentric];
    }
  });
  return {
    current_exercise_index: state.exerciseIndex,
    current_set: state.setNumber,
    current_side: state.side,
    current_rep: state.reps,
    current_phase: state.phase,
    phase_started_at: iso(state.phaseStartedAt),
    phase_duration_ms: timed ? Math.max(0, (state.phaseEndsAt as number) - (state.phaseStartedAt as number)) : null,
    remaining_ms: state.paused && state.remainingMs !== null ? Math.round(state.remainingMs) : null,
    paused: state.paused,
    paused_ms_total: Math.round(state.pausedMsTotal),
    paused_at: state.paused ? iso(state.pausedAt) : null,
    tempo_override: Object.keys(overrides).length > 0 ? overrides : null,
  };
}

function applyTempoOverrides(exercises: EngineExercise[], overrides: CheckpointRow["tempo_override"]): EngineExercise[] {
  if (!overrides) return exercises;
  return exercises.map((e) => {
    const o = overrides[String(e.order)];
    if (!o || e.measureType !== "reps") return e;
    const tempo: Tempo = { eccentric: o[0], pause: o[1], concentric: o[2] };
    return { ...e, tempo };
  });
}

/**
 * Rebuild the engine from the last checkpoint ("Continue Previous Workout").
 *
 * Time validation: the workout always comes back PAUSED at the checkpoint.
 * Time spent away is never treated as exercise or rest:
 *  - rest / timed hold keep the time that was left at the last checkpoint,
 *  - a preparation countdown restarts from 10 s,
 *  - rep work keeps the reps the user had confirmed.
 * Away time is counted as paused time when the user presses Resume.
 */
export function restoreFromCheckpoint(exercises: EngineExercise[], row: CheckpointRow): EngineState {
  const base = createInitialState(applyTempoOverrides(exercises, row.tempo_override));
  const phase = PHASES.includes(row.current_phase as PhaseKind) ? (row.current_phase as PhaseKind) : "intro";
  if (phase === "intro" || exercises.length === 0) return base;

  const index = Math.min(Math.max(row.current_exercise_index, 0), exercises.length - 1);
  if (phase === "complete") return { ...base, exerciseIndex: index, phase: "complete" };

  const ex = base.exercises[index];
  const startedAt = ms(row.phase_started_at);
  const duration = row.phase_duration_ms;
  const checkpointAt = ms(row.updated_at) ?? Date.now();
  const pausedAt = row.paused ? (ms(row.paused_at) ?? checkpointAt) : checkpointAt;

  let remaining: number | null = null;
  if (phase === "prepare") {
    remaining = PREPARE_MS;
  } else if (duration !== null && startedAt !== null) {
    remaining = row.paused && row.remaining_ms !== null
      ? row.remaining_ms
      : Math.min(duration, Math.max(0, startedAt + duration - checkpointAt));
  }

  const validSide = (s: Side | null): Side | null => {
    if (ex.sideMode === "per_side") return s === "left" || s === "right" ? s : "left";
    if (ex.sideMode === "per_direction") return s === "forward" || s === "backward" ? s : "forward";
    return null;
  };

  return {
    ...base,
    exerciseIndex: index,
    setNumber: Math.min(Math.max(row.current_set, 1), ex.sets),
    side: validSide(row.current_side),
    phase,
    phaseStartedAt: startedAt ?? pausedAt,
    phaseEndsAt: remaining === null ? null : pausedAt + remaining,
    tempoAnchorAt: null,
    reps: phase === "work" && ex.measureType === "reps" ? Math.min(Math.max(row.current_rep, 0), ex.target) : 0,
    paused: true,
    pausedAt,
    pauseReason: "recovered",
    remainingMs: remaining,
    pausedMsTotal: Math.max(0, row.paused_ms_total),
    workPausedMs: 0,
    lastTickAt: null,
  };
}
