"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exerciseResult, sidesFor, type SetRow } from "@/lib/engine/results";
import type { SetResult } from "@/lib/engine/workout-engine";
import { isIsoDate } from "@/lib/program/calendar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import type { CheckpointRow } from "@/lib/engine/checkpoint";
import { decideAdjustment, type Difficulty, type ExerciseOutcome } from "@/lib/progression/adaptive";

/**
 * Workout session mutations. Every action re-checks the signed-in user and
 * filters by user_id (RLS also applies). Writes are idempotent so retries
 * after a network error can't duplicate data.
 */

const UUID = /^[0-9a-f-]{36}$/i;

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ActionResult = { ok: true } | { ok: false; error: string };

async function context(sessionId: string) {
  if (!UUID.test(sessionId)) throw new Error("Invalid session");
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  return { user, supabase };
}

async function loadSession(supabase: Supabase, userId: string, sessionId: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id,status,scheduled_date,performed_at,started_at,program_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    status: string;
    scheduled_date: string;
    performed_at: string | null;
    started_at: string;
    program_id: string;
  } | null;
}

const START_ERRORS: Record<string, string> = {
  program_not_active: "You don't have an active program.",
  outside_program: "Today is outside your 12-week program.",
  not_a_workout_day: "That day isn't a strength workout day.",
  not_yet_scheduled: "This workout isn't scheduled yet. It can be started on its day.",
  already_completed: "This workout has already been completed.",
  invalid_date: "Invalid workout date.",
};

// ---------------------------------------------------------------------------
// Start / begin
// ---------------------------------------------------------------------------

export type StartState = { error?: string };

/**
 * Start the workout scheduled for `scheduledDate` — today's, or an earlier
 * one that isn't completed (catch-up). The database function validates the
 * day (never in the future), snapshots that day's prescriptions, and returns
 * the existing active session instead of a duplicate.
 */
export async function startWorkout(_prev: StartState, formData: FormData): Promise<StartState> {
  await requireUser();
  const programId = String(formData.get("programId") ?? "");
  const scheduledDate = String(formData.get("scheduledDate") ?? "");
  if (!UUID.test(programId)) return { error: "Invalid program." };
  if (!isIsoDate(scheduledDate)) return { error: "Invalid workout date." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("start_workout_session", {
    p_program_id: programId,
    p_scheduled_date: scheduledDate,
  });
  if (error) {
    const known = START_ERRORS[error.message];
    return { error: known ?? "Could not start the workout. Check your connection and try again." };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { out_session_id: string } | undefined;
  if (!row?.out_session_id) return { error: "Could not start the workout. Try again." };

  revalidatePath("/", "layout");
  redirect(`/workout/session/${row.out_session_id}`);
}

/** The user pressed "Begin": record when the workout was actually performed. */
export async function markWorkoutBegun(sessionId: string): Promise<ActionResult> {
  const { user, supabase } = await context(sessionId);
  const { error } = await supabase
    .from("workout_sessions")
    .update({ performed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .is("performed_at", null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ---------------------------------------------------------------------------
// Interruption & recovery
// ---------------------------------------------------------------------------

/** Called when a page opens a session that was already running. */
export async function markInterrupted(sessionId: string): Promise<ActionResult> {
  const { user, supabase } = await context(sessionId);
  const { error } = await supabase
    .from("workout_sessions")
    .update({ status: "interrupted" })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("status", "in_progress");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type ContinueResult =
  | { ok: true; checkpoint: CheckpointRow }
  | { ok: false; error: string };

/**
 * "Continue Previous Workout". The workout keeps its scheduled date (a later
 * continuation is simply a catch-up). Bumps the checkpoint revision so any
 * other device still showing this workout stops writing to it.
 */
export async function continueWorkout(sessionId: string): Promise<ContinueResult> {
  const { user, supabase } = await context(sessionId);
  const session = await loadSession(supabase, user.id, sessionId);
  if (!session || !["in_progress", "interrupted"].includes(session.status)) {
    return { ok: false, error: "This workout can no longer be continued." };
  }

  const { error: statusError } = await supabase
    .from("workout_sessions")
    .update({ status: "in_progress" })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .in("status", ["in_progress", "interrupted"]);
  if (statusError) return { ok: false, error: "Could not continue the workout. Try again." };

  const { data: current, error: loadError } = await supabase
    .from("workout_session_state")
    .select("revision")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .single();
  if (loadError) return { ok: false, error: "Could not load your progress. Try again." };

  const { data, error } = await supabase
    .from("workout_session_state")
    .update({ revision: (current.revision as number) + 1 })
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .select(
      "current_exercise_index,current_set,current_side,current_rep,current_phase,phase_started_at," +
        "phase_duration_ms,remaining_ms,paused,paused_ms_total,paused_at,tempo_override,revision,updated_at",
    )
    .single();
  if (error || !data) return { ok: false, error: "Could not load your progress. Try again." };
  return { ok: true, checkpoint: data as unknown as CheckpointRow };
}

/**
 * "Start Over": the previous attempt is kept as abandoned (never deleted),
 * then the same scheduled workout is started fresh.
 */
export async function startOver(sessionId: string): Promise<ActionResult> {
  const { user, supabase } = await context(sessionId);
  const session = await loadSession(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "Workout not found." };

  if (["in_progress", "interrupted"].includes(session.status)) {
    const { error } = await supabase
      .from("workout_sessions")
      .update({ status: "abandoned" })
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .in("status", ["in_progress", "interrupted"]);
    if (error) return { ok: false, error: "Could not end the previous workout. Try again." };
  }

  const { data, error } = await supabase.rpc("start_workout_session", {
    p_program_id: session.program_id,
    p_scheduled_date: session.scheduled_date,
  });
  revalidatePath("/", "layout");
  const row = (Array.isArray(data) ? data[0] : data) as { out_session_id: string } | undefined;
  if (error || !row?.out_session_id) {
    // Previous attempt ended; this workout can't be started again (e.g. program over).
    redirect(`/workout?ended=${error ? encodeURIComponent(error.message) : "1"}`);
  }
  redirect(`/workout/session/${row.out_session_id}`);
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

async function loadExercise(supabase: Supabase, userId: string, sessionId: string, order: number) {
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("id,prescribed_sets,prescribed_target,side_mode,measure_type")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("order_index", order)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; prescribed_sets: number; prescribed_target: number; side_mode: string; measure_type: string } | null;
}

async function refreshExerciseStatus(supabase: Supabase, userId: string, exerciseRowId: string, prescribedSets: number, sideMode: string, final: boolean) {
  const { data, error } = await supabase
    .from("workout_sets")
    .select("set_number,side,achieved,status")
    .eq("workout_exercise_id", exerciseRowId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const result = exerciseResult(prescribedSets, sideMode, (data ?? []) as SetRow[], final);
  const { error: updateError } = await supabase
    .from("workout_exercises")
    .update({ completed_sets: result.completedSets, status: result.status })
    .eq("id", exerciseRowId)
    .eq("user_id", userId);
  if (updateError) throw new Error(updateError.message);
}

/** Persist one finished set (or one side of a unilateral set). Idempotent. */
export async function recordSet(sessionId: string, result: SetResult): Promise<ActionResult> {
  const { user, supabase } = await context(sessionId);
  const session = await loadSession(supabase, user.id, sessionId);
  if (!session || session.status !== "in_progress") return { ok: false, error: "Workout is not active." };

  const exercise = await loadExercise(supabase, user.id, sessionId, result.exerciseOrder);
  if (!exercise) return { ok: false, error: "Unknown exercise." };
  const sides = sidesFor(exercise.side_mode);
  const valid =
    Number.isInteger(result.setNumber) && result.setNumber >= 1 && result.setNumber <= exercise.prescribed_sets &&
    sides.includes(result.side ?? null) &&
    Number.isInteger(result.achieved) && result.achieved >= 0 && result.achieved <= exercise.prescribed_target &&
    ["completed", "partial", "skipped"].includes(result.status) &&
    (result.durationSeconds === null || (Number.isInteger(result.durationSeconds) && result.durationSeconds >= 0 && result.durationSeconds <= 3600));
  if (!valid) return { ok: false, error: "Invalid set data." };

  // Status is derived server-side from the numbers, not trusted from the client.
  const status = result.achieved >= exercise.prescribed_target ? "completed" : result.achieved > 0 ? "partial" : "skipped";

  const { error } = await supabase.from("workout_sets").upsert(
    {
      workout_exercise_id: exercise.id,
      user_id: user.id,
      set_number: result.setNumber,
      side: result.side,
      target: exercise.prescribed_target,
      achieved: result.achieved,
      duration_seconds: result.durationSeconds,
      status,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "workout_exercise_id,set_number,side", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };

  await refreshExerciseStatus(supabase, user.id, exercise.id, exercise.prescribed_sets, exercise.side_mode, false);
  return { ok: true };
}

/** Skip the rest of an exercise: remaining sets/sides are stored as skipped. */
export async function skipExercise(sessionId: string, exerciseOrder: number): Promise<ActionResult> {
  const { user, supabase } = await context(sessionId);
  const session = await loadSession(supabase, user.id, sessionId);
  if (!session || session.status !== "in_progress") return { ok: false, error: "Workout is not active." };
  const exercise = await loadExercise(supabase, user.id, sessionId, exerciseOrder);
  if (!exercise) return { ok: false, error: "Unknown exercise." };

  const rows = [];
  for (let set = 1; set <= exercise.prescribed_sets; set++) {
    for (const side of sidesFor(exercise.side_mode)) {
      rows.push({
        workout_exercise_id: exercise.id,
        user_id: user.id,
        set_number: set,
        side,
        target: exercise.prescribed_target,
        achieved: 0,
        status: "skipped",
      });
    }
  }
  // Existing rows (already done sets) are kept; only missing ones become skipped.
  const { error } = await supabase
    .from("workout_sets")
    .upsert(rows, { onConflict: "workout_exercise_id,set_number,side", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  await refreshExerciseStatus(supabase, user.id, exercise.id, exercise.prescribed_sets, exercise.side_mode, true);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Finish
// ---------------------------------------------------------------------------

async function finalizeExercises(supabase: Supabase, userId: string, sessionId: string): Promise<number> {
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("id,prescribed_sets,side_mode")
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  let doneSets = 0;
  for (const e of (data ?? []) as { id: string; prescribed_sets: number; side_mode: string }[]) {
    await refreshExerciseStatus(supabase, userId, e.id, e.prescribed_sets, e.side_mode, true);
  }
  const { data: totals, error: totalsError } = await supabase
    .from("workout_exercises")
    .select("completed_sets")
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  if (totalsError) throw new Error(totalsError.message);
  for (const t of (totals ?? []) as { completed_sets: number }[]) doneSets += t.completed_sets;
  return doneSets;
}

function clampDuration(activeSeconds: number, performedAt: string | null, startedAt: string): number {
  const wall = Math.max(0, Math.round((Date.now() - Date.parse(performedAt ?? startedAt)) / 1000));
  const value = Number.isFinite(activeSeconds) ? Math.round(activeSeconds) : wall;
  return Math.min(Math.max(0, value), wall);
}

/**
 * All exercises finished. Saved as completed only if at least one set was
 * done; a workout where everything was skipped is saved as stopped.
 */
export async function completeWorkout(sessionId: string, activeSeconds: number): Promise<ActionResult> {
  const { user, supabase } = await context(sessionId);
  const session = await loadSession(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "Workout not found." };
  if (session.status === "completed") return { ok: true }; // retry after success
  if (session.status !== "in_progress") return { ok: false, error: "Workout is not active." };

  const doneSets = await finalizeExercises(supabase, user.id, sessionId);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("workout_sessions")
    .update({
      status: doneSets > 0 ? "completed" : "stopped",
      completed_at: doneSets > 0 ? now : null,
      performed_at: session.performed_at ?? now,
      duration_seconds: clampDuration(activeSeconds, session.performed_at, session.started_at),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("status", "in_progress");
  if (error?.code === "23505") {
    return { ok: false, error: "This scheduled workout was already completed in another session." };
  }
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Stop early (confirmed by the user). Never marks the workout completed. */
export async function stopWorkout(sessionId: string, activeSeconds: number): Promise<ActionResult> {
  const { user, supabase } = await context(sessionId);
  const session = await loadSession(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "Workout not found." };
  if (session.status === "stopped") return { ok: true };
  if (!["in_progress", "interrupted"].includes(session.status)) return { ok: false, error: "Workout is not active." };

  await finalizeExercises(supabase, user.id, sessionId);
  const { error } = await supabase
    .from("workout_sessions")
    .update({
      status: "stopped",
      duration_seconds: clampDuration(activeSeconds, session.performed_at, session.started_at),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .in("status", ["in_progress", "interrupted"]);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Feedback & sound
// ---------------------------------------------------------------------------

export type FeedbackState = { error?: string; saved?: boolean; message?: string };

const FEEDBACK_ERRORS: Record<string, string> = {
  not_completed: "Feedback can only be given for a completed workout.",
  session_not_found: "Workout not found.",
  feedback_locked: "This feedback can no longer be changed because your next workout of this type has already started.",
  progression_blocked_pain: "Nothing is increased when you report pain.",
  exercise_not_performed: "Only exercises you actually did can be adjusted.",
  exercise_not_completed: "Targets only go up after every set was completed.",
  invalid_adjustment: "The adjustment didn't pass the safety checks, so nothing was changed. Try again.",
};

type FeedbackRow = Record<string, unknown>;

/**
 * Save Too Easy / Just Right / Too Hard and, if appropriate, ONE conservative
 * adjustment (see src/lib/progression/adaptive.ts). The database function
 * save_workout_feedback writes both atomically, re-validates every safety
 * rule, and replaces (never duplicates) an earlier answer for this workout.
 */
export async function submitFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const sessionId = String(formData.get("sessionId") ?? "");
  const difficulty = String(formData.get("difficulty") ?? "") as Difficulty;
  const painReported = formData.get("painReported") === "on";
  const notesRaw = String(formData.get("notes") ?? "").trim();
  if (!["too_easy", "just_right", "too_hard"].includes(difficulty)) return { error: "Choose how the workout felt." };
  if (notesRaw.length > 1000) return { error: "Notes are too long (max 1000 characters)." };

  const { user, supabase } = await context(sessionId);
  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("id,status,activity_type")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sessionError) return { error: "Could not load the workout. Try again." };
  if (!session || session.status !== "completed") return { error: FEEDBACK_ERRORS.not_completed };

  const [exercises, history] = await Promise.all([
    supabase
      .from("workout_exercises")
      .select(
        "exercise_id,exercise_name_snapshot,order_index,measure_type,side_mode,status,prescribed_sets,prescribed_target," +
          "base:program_exercises(sets,target_min,target_max)," +
          "meta:exercise_library(movement_type,progression_step,progression_headroom,regression_room,max_extra_sets)," +
          "sets:workout_sets(achieved,status)",
      )
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("order_index"),
    supabase
      .from("adaptive_adjustments")
      .select("exercise_id,created_at,source_session_id")
      .eq("user_id", user.id)
      .eq("activity_type", session.activity_type as string)
      .order("created_at", { ascending: false }),
  ]);
  if (exercises.error || history.error) return { error: "Could not load the workout results. Try again." };

  const lastAdjusted = new Map<string, string>();
  for (const h of (history.data ?? []) as FeedbackRow[]) {
    if (h.source_session_id === sessionId) continue; // this workout's earlier answer is being replaced
    if (!lastAdjusted.has(h.exercise_id as string)) lastAdjusted.set(h.exercise_id as string, h.created_at as string);
  }

  const outcomes: ExerciseOutcome[] = ((exercises.data ?? []) as unknown as FeedbackRow[])
    .filter((r) => r.base && r.meta)
    .map((r) => {
      const base = r.base as FeedbackRow;
      const meta = r.meta as FeedbackRow;
      return {
        exerciseId: r.exercise_id as string,
        name: r.exercise_name_snapshot as string,
        order: r.order_index as number,
        measureType: r.measure_type as ExerciseOutcome["measureType"],
        sideMode: r.side_mode as ExerciseOutcome["sideMode"],
        status: r.status as ExerciseOutcome["status"],
        prescribedSets: r.prescribed_sets as number,
        prescribedTarget: r.prescribed_target as number,
        base: { sets: base.sets as number, targetMin: base.target_min as number, targetMax: base.target_max as number },
        meta: {
          movementType: meta.movement_type as ExerciseOutcome["meta"]["movementType"],
          step: meta.progression_step as number,
          headroom: meta.progression_headroom as number,
          regressionRoom: meta.regression_room as number,
          maxExtraSets: meta.max_extra_sets as number,
        },
        rows: ((r.sets as FeedbackRow[]) ?? []).map((x) => ({
          achieved: x.achieved as number,
          status: x.status as "completed" | "partial" | "skipped",
        })),
        lastAdjustedAt: lastAdjusted.get(r.exercise_id as string) ?? null,
      };
    });

  const decision = decideAdjustment({ difficulty, painReported, exercises: outcomes });
  const a = decision.adjustment;
  const { error } = await supabase.rpc("save_workout_feedback", {
    p_session_id: sessionId,
    p_difficulty: difficulty,
    p_pain: painReported,
    p_notes: notesRaw || null,
    p_adjustment: a
      ? {
          exercise_id: a.exerciseId,
          change_type: a.changeType,
          previous_sets: a.previousSets,
          previous_target: a.previousTarget,
          new_sets: a.newSets,
          new_target: a.newTarget,
          reason: a.reason,
        }
      : null,
  });
  if (error) return { error: FEEDBACK_ERRORS[error.message] ?? "Could not save your feedback. Try again." };

  revalidatePath(`/workout/session/${sessionId}/summary`);
  revalidatePath("/progress");
  revalidatePath("/workout", "layout");
  return { saved: true, message: decision.message };
}

export async function saveSoundSettings(enabled: boolean, volume: number): Promise<ActionResult> {
  const user = await requireUser();
  const v = Number.isFinite(volume) ? Math.min(1, Math.max(0, Math.round(volume * 100) / 100)) : 0.8;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ sound_enabled: Boolean(enabled), sound_volume: v })
    .eq("user_id", user.id);
  return error ? { ok: false, error: "Could not save sound settings." } : { ok: true };
}
