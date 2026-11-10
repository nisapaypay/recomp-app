import "server-only";

import { cache } from "react";
import type { CheckpointRow } from "@/lib/engine/checkpoint";
import type { SetRow } from "@/lib/engine/results";
import { tempoStartFor } from "@/lib/engine/tempo-start";
import type { EngineExercise } from "@/lib/engine/workout-engine";
import type { IsoDate } from "@/lib/program/calendar";
import type { ActivityType } from "@/lib/program/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

/**
 * Workout session data access. Every query runs with the user's session
 * (RLS) and is additionally filtered by user_id.
 */

export type SessionStatus = "in_progress" | "completed" | "stopped" | "interrupted" | "abandoned";

export type SessionInfo = {
  id: string;
  programId: string;
  status: SessionStatus;
  /** Program day the workout belongs to (never shifts). */
  scheduledDate: IsoDate;
  /** When the user actually began it (null if never begun). */
  performedAt: string | null;
  weekNumber: number;
  activityType: ActivityType;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
};

export type SessionExercise = {
  id: string;
  order: number;
  exerciseId: string;
  name: string;
  measureType: "reps" | "seconds";
  sideMode: "none" | "per_side" | "per_direction";
  sets: number;
  target: number;
  tempo: { eccentric: number; pause: number; concentric: number } | null;
  restSeconds: number;
  completedSets: number;
  status: "pending" | "in_progress" | "completed" | "partial" | "skipped";
  // Library details for the player
  targetMuscles: string[];
  startingPosition: string | null;
  executionSteps: string[];
  breathing: string | null;
  illustrationPath: string | null;
  sets_rows: (SetRow & { target: number; duration_seconds: number | null })[];
};

type Row = Record<string, unknown>;

const SESSION_COLUMNS =
  "id,program_id,status,scheduled_date,performed_at,week_number,activity_type,started_at,completed_at,duration_seconds";

function mapSession(r: Row): SessionInfo {
  return {
    id: r.id as string,
    programId: r.program_id as string,
    status: r.status as SessionStatus,
    scheduledDate: r.scheduled_date as IsoDate,
    performedAt: (r.performed_at as string | null) ?? null,
    weekNumber: r.week_number as number,
    activityType: r.activity_type as ActivityType,
    startedAt: r.started_at as string,
    completedAt: (r.completed_at as string | null) ?? null,
    durationSeconds: (r.duration_seconds as number | null) ?? null,
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`Could not load ${what}: ${error.message}`);
}

/** The user's active (in_progress or interrupted) session, if any. */
export const getActiveSession = cache(async (): Promise<SessionInfo | null> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", user.id)
    .in("status", ["in_progress", "interrupted"])
    .maybeSingle();
  if (error) fail("the active workout", error);
  return data ? mapSession(data as Row) : null;
});

/** Latest completed / stopped session scheduled for a date (for links to the summary). */
export const getFinishedSessionForDate = cache(async (date: IsoDate): Promise<SessionInfo | null> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", user.id)
    .eq("scheduled_date", date)
    .in("status", ["completed", "stopped"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("the workout", error);
  return data ? mapSession(data as Row) : null;
});

export type SessionBundle = {
  session: SessionInfo;
  exercises: SessionExercise[];
  checkpoint: CheckpointRow | null;
  feedback: { difficulty: "too_easy" | "just_right" | "too_hard"; painReported: boolean; notes: string | null } | null;
};

/** Everything the player / summary needs for one of the user's sessions. */
export const getSessionBundle = cache(async (sessionId: string): Promise<SessionBundle | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: session, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) fail("the workout", error);
  if (!session) return null;

  const [exercises, state, feedback] = await Promise.all([
    supabase
      .from("workout_exercises")
      .select(
        "id,order_index,exercise_id,exercise_name_snapshot,measure_type,side_mode,prescribed_sets,prescribed_target," +
          "tempo_eccentric_s,tempo_pause_s,tempo_concentric_s,rest_seconds,completed_sets,status," +
          "exercise:exercise_library(target_muscles,starting_position,execution_steps,breathing,illustration_path)," +
          "sets:workout_sets(set_number,side,target,achieved,status,duration_seconds)",
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("order_index"),
    supabase
      .from("workout_session_state")
      .select(
        "current_exercise_index,current_set,current_side,current_rep,current_phase,phase_started_at," +
          "phase_duration_ms,remaining_ms,paused,paused_ms_total,paused_at,tempo_override,revision,updated_at",
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("workout_feedback")
      .select("difficulty,pain_reported,notes")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (exercises.error) fail("the workout exercises", exercises.error);
  if (state.error) fail("the workout progress", state.error);
  if (feedback.error) fail("the workout feedback", feedback.error);

  const mapped: SessionExercise[] = (exercises.data as unknown as Row[]).map((r) => {
    const lib = (r.exercise as Row | null) ?? {};
    const e = r.tempo_eccentric_s as number | null;
    const p = r.tempo_pause_s as number | null;
    const c = r.tempo_concentric_s as number | null;
    return {
      id: r.id as string,
      order: r.order_index as number,
      exerciseId: r.exercise_id as string,
      name: r.exercise_name_snapshot as string,
      measureType: r.measure_type as SessionExercise["measureType"],
      sideMode: r.side_mode as SessionExercise["sideMode"],
      sets: r.prescribed_sets as number,
      target: r.prescribed_target as number,
      tempo: e !== null && p !== null && c !== null ? { eccentric: e, pause: p, concentric: c } : null,
      restSeconds: r.rest_seconds as number,
      completedSets: r.completed_sets as number,
      status: r.status as SessionExercise["status"],
      targetMuscles: (lib.target_muscles as string[]) ?? [],
      startingPosition: (lib.starting_position as string | null) ?? null,
      executionSteps: (lib.execution_steps as string[]) ?? [],
      breathing: (lib.breathing as string | null) ?? null,
      illustrationPath: (lib.illustration_path as string | null) ?? null,
      sets_rows: ((r.sets as Row[]) ?? []).map((s) => ({
        set_number: s.set_number as number,
        side: (s.side as string | null) ?? null,
        target: s.target as number,
        achieved: s.achieved as number,
        status: s.status as SetRow["status"],
        duration_seconds: (s.duration_seconds as number | null) ?? null,
      })),
    };
  });

  const fb = feedback.data as Row | null;
  return {
    session: mapSession(session as Row),
    exercises: mapped,
    checkpoint: (state.data as unknown as CheckpointRow | null) ?? null,
    feedback: fb
      ? {
          difficulty: fb.difficulty as "too_easy" | "just_right" | "too_hard",
          painReported: fb.pain_reported as boolean,
          notes: (fb.notes as string | null) ?? null,
        }
      : null,
  };
});

/** All of the user's workout attempts, newest first (History). */
export const getSessionHistory = cache(async (limit = 100): Promise<SessionInfo[]> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("workout history", error);
  return (data as Row[]).map(mapSession);
});

export function toEngineExercises(exercises: SessionExercise[]): EngineExercise[] {
  return exercises.map((e) => ({
    order: e.order,
    name: e.name,
    measureType: e.measureType,
    sideMode: e.sideMode,
    sets: e.sets,
    target: e.target,
    tempo: e.tempo,
    tempoStart: tempoStartFor(e.exerciseId),
    restSeconds: e.restSeconds,
  }));
}

export async function getSoundPreferences(): Promise<{ enabled: boolean; volume: number }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("sound_enabled,sound_volume")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) fail("sound settings", error);
  return {
    enabled: (data?.sound_enabled as boolean | undefined) ?? true,
    volume: Number(data?.sound_volume ?? 0.8),
  };
}
