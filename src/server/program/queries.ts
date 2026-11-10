import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { todayIn, type IsoDate } from "@/lib/program/calendar";
import { sessionKey, type ActivityRecords } from "@/lib/program/completion";
import type { Tempo } from "@/lib/program/estimate";
import type { ActivityType, DayOfWeek } from "@/lib/program/schedule";
import type {
  Exercise,
  Prescription,
  ProgramDay,
  ProgramStatus,
  UserProgram,
} from "@/lib/program/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

/**
 * Server-side program data access. Every query runs with the signed-in
 * user's session (RLS applies) and personal tables are additionally filtered
 * by user_id. Reference tables are shared read-only data.
 */

/** Today's date in the program timezone (Asia/Jakarta). Request-time only. */
export async function getToday(): Promise<IsoDate> {
  await connection();
  return todayIn();
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

function tempoFrom(e: unknown, p: unknown, c: unknown): Tempo | null {
  if (typeof e !== "number" || typeof p !== "number" || typeof c !== "number") return null;
  return { eccentric: e, pause: p, concentric: c };
}

const EXERCISE_COLUMNS =
  "id,name,category,target_muscles,equipment,measure_type,side_mode,tempo_eccentric_s,tempo_pause_s," +
  "tempo_concentric_s,default_rest_seconds,difficulty,description,starting_position,execution_steps," +
  "breathing,common_mistakes,safe_modifications,illustration_path";

function mapExercise(r: Row): Exercise {
  return {
    id: r.id as string,
    name: r.name as string,
    category: r.category as Exercise["category"],
    targetMuscles: (r.target_muscles as string[]) ?? [],
    equipment: r.equipment as Exercise["equipment"],
    measureType: r.measure_type as Exercise["measureType"],
    sideMode: r.side_mode as Exercise["sideMode"],
    defaultTempo: tempoFrom(r.tempo_eccentric_s, r.tempo_pause_s, r.tempo_concentric_s),
    defaultRestSeconds: r.default_rest_seconds as number,
    difficulty: r.difficulty as Exercise["difficulty"],
    description: (r.description as string | null) ?? null,
    startingPosition: (r.starting_position as string | null) ?? null,
    executionSteps: (r.execution_steps as string[]) ?? [],
    breathing: (r.breathing as string | null) ?? null,
    commonMistakes: (r.common_mistakes as string[]) ?? [],
    safeModifications: (r.safe_modifications as string[]) ?? [],
    illustrationPath: (r.illustration_path as string | null) ?? null,
  };
}

function mapPrescription(r: Row): Prescription {
  const exercise = mapExercise(r.exercise as Row);
  return {
    id: r.id as string,
    weekNumber: r.week_number as number,
    dayOfWeek: r.day_of_week as DayOfWeek,
    orderIndex: r.order_index as number,
    sets: r.sets as number,
    targetMin: r.target_min as number,
    targetMax: r.target_max as number,
    // Program overrides win; otherwise the exercise's defaults.
    tempo: tempoFrom(r.tempo_eccentric_s, r.tempo_pause_s, r.tempo_concentric_s) ?? exercise.defaultTempo,
    restSeconds: (r.rest_seconds as number | null) ?? exercise.defaultRestSeconds,
    notes: (r.notes as string | null) ?? null,
    exercise,
  };
}

function mapProgramDay(r: Row): ProgramDay {
  const min = r.walking_target_min_minutes as number | null;
  const max = r.walking_target_max_minutes as number | null;
  return {
    weekNumber: r.week_number as number,
    dayOfWeek: r.day_of_week as DayOfWeek,
    activity: r.activity_type as ActivityType,
    walkingTargetMinutes: min !== null && max !== null ? { min, max } : null,
  };
}

const PRESCRIPTION_COLUMNS =
  "id,week_number,day_of_week,order_index,sets,target_min,target_max,tempo_eccentric_s,tempo_pause_s," +
  `tempo_concentric_s,rest_seconds,notes,exercise:exercise_library(${EXERCISE_COLUMNS})`;

function fail(what: string, error: { message: string }): never {
  throw new Error(`Could not load ${what}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// User program
// ---------------------------------------------------------------------------

/**
 * The user's current program (newest active or completed), or null.
 * An active program whose 12 weeks have ended is marked completed here, so
 * the status is correct no matter which device opens the app first.
 */
export const getCurrentProgram = cache(async (): Promise<UserProgram | null> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_programs")
    .select("id,start_date,end_date,status")
    .eq("user_id", user.id)
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("your program", error);
  if (!data) return null;

  const program: UserProgram = {
    id: data.id as string,
    startDate: data.start_date as IsoDate,
    endDate: data.end_date as IsoDate,
    status: data.status as ProgramStatus,
  };

  const today = await getToday();
  if (program.status === "active" && today > program.endDate) {
    const { error: updateError } = await supabase
      .from("user_programs")
      .update({ status: "completed" })
      .eq("id", program.id)
      .eq("user_id", user.id)
      .eq("status", "active");
    if (updateError) fail("program status", updateError);
    program.status = "completed";
  }
  return program;
});

/** Number of workout sessions recorded for a program (any status). */
export async function countProgramSessions(programId: string): Promise<number> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("workout_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("program_id", programId);
  if (error) fail("workout sessions", error);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Reference program data
// ---------------------------------------------------------------------------

export const getProgramWeek = cache(
  async (week: number): Promise<{ days: ProgramDay[]; prescriptions: Prescription[] }> => {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    const [daysResult, prescriptionsResult] = await Promise.all([
      supabase
        .from("program_days")
        .select("week_number,day_of_week,activity_type,walking_target_min_minutes,walking_target_max_minutes")
        .eq("week_number", week)
        .order("day_of_week"),
      supabase
        .from("program_exercises")
        .select(PRESCRIPTION_COLUMNS)
        .eq("week_number", week)
        .order("day_of_week")
        .order("order_index"),
    ]);
    if (daysResult.error) fail("the weekly schedule", daysResult.error);
    if (prescriptionsResult.error) fail("the workouts", prescriptionsResult.error);
    return {
      days: (daysResult.data as Row[]).map(mapProgramDay),
      prescriptions: (prescriptionsResult.data as unknown as Row[]).map(mapPrescription),
    };
  },
);

export const getExerciseLibrary = cache(async (): Promise<Exercise[]> => {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("exercise_library").select(EXERCISE_COLUMNS).order("name");
  if (error) fail("the exercise library", error);
  return (data as unknown as Row[]).map(mapExercise);
});

export const getExerciseWithPrescriptions = cache(
  async (id: string): Promise<{ exercise: Exercise; prescriptions: Prescription[] } | null> => {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("program_exercises")
      .select(PRESCRIPTION_COLUMNS)
      .eq("exercise_id", id)
      .order("week_number")
      .order("day_of_week");
    if (error) fail("the exercise", error);
    const prescriptions = (data as unknown as Row[]).map(mapPrescription);
    if (prescriptions.length > 0) return { exercise: prescriptions[0].exercise, prescriptions };

    const single = await supabase.from("exercise_library").select(EXERCISE_COLUMNS).eq("id", id).maybeSingle();
    if (single.error) fail("the exercise", single.error);
    return single.data ? { exercise: mapExercise(single.data as unknown as Row), prescriptions: [] } : null;
  },
);

// ---------------------------------------------------------------------------
// Activity records (completion) — real data only
// ---------------------------------------------------------------------------

export type ProgramRecords = ActivityRecords & {
  /** All walks logged in the program window: program walks + additional walks. */
  walkCount: number;
  /** Walks logged as additional (outside the schedule) in the program window. */
  additionalWalkCount: number;
  /** sessionKey(scheduled date, activity) → performed_at of the completed session. */
  performedAt: Map<string, string>;
};

export const getActivityRecords = cache(
  async (from: IsoDate, to: IsoDate): Promise<ProgramRecords> => {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const [sessions, walks] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("scheduled_date,activity_type,performed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gte("scheduled_date", from)
        .lte("scheduled_date", to),
      supabase
        .from("walking_activities")
        .select("activity_date,scheduled_date")
        .eq("user_id", user.id)
        .or(`and(scheduled_date.gte.${from},scheduled_date.lte.${to}),and(scheduled_date.is.null,activity_date.gte.${from},activity_date.lte.${to})`),
    ]);
    if (sessions.error) fail("completed workouts", sessions.error);
    if (walks.error) fail("walks", walks.error);
    const sessionRows = sessions.data as Row[];
    const walkRows = walks.data as Row[];
    return {
      // Completion counts for the SCHEDULED day, whenever it was performed.
      completedSessions: new Set(
        sessionRows.map((s) => sessionKey(s.scheduled_date as IsoDate, s.activity_type as ActivityType)),
      ),
      performedAt: new Map(
        sessionRows
          .filter((s) => typeof s.performed_at === "string")
          .map((s) => [sessionKey(s.scheduled_date as IsoDate, s.activity_type as ActivityType), s.performed_at as string]),
      ),
      // A walk completes its SCHEDULED Tuesday/Saturday (logged that day or later); additional walks never do.
      walkDates: new Set(walkRows.filter((w) => w.scheduled_date).map((w) => w.scheduled_date as IsoDate)),
      walkCount: walkRows.length,
      additionalWalkCount: walkRows.filter((w) => !w.scheduled_date).length,
    };
  },
);
