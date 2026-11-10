import "server-only";

import { cache } from "react";
import { addDays, diffDays, type IsoDate } from "@/lib/program/calendar";
import { activityForDate, isDayCompleted } from "@/lib/program/completion";
import { WEEKLY_SCHEDULE, countsTowardCompletion } from "@/lib/program/schedule";
import {
  bodyChanges,
  reportKind,
  trainingSummary,
  walkingReport,
  weeklyTimeline,
  type ReportExercise,
  type ReportSession,
} from "@/lib/report/report";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { getCurrentProgram } from "@/server/program/queries";
import { getProgramOverview } from "@/server/program/view";
import { getMeasurements } from "@/server/progress/queries";
import { getAdjustmentHistory } from "@/server/progression/queries";
import { getWalkingContext, getWalks } from "@/server/walking/queries";

type Row = Record<string, unknown>;

/** Everything the 12-week report needs (read-only; real records only). Null without a program. */
export const getReportData = cache(async () => {
  const program = await getCurrentProgram();
  if (!program) return null;
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [overview, measurements, walks, walkingCtx, adjustments] = await Promise.all([
    getProgramOverview(program),
    getMeasurements(),
    getWalks(),
    getWalkingContext(),
    getAdjustmentHistory(),
  ]);

  const sessionsRes = await supabase
    .from("workout_sessions")
    .select("id,week_number,scheduled_date,activity_type")
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .eq("status", "completed")
    .order("scheduled_date");
  if (sessionsRes.error) throw new Error(`Could not load workouts: ${sessionsRes.error.message}`);
  const sessions: ReportSession[] = (sessionsRes.data as Row[])
    .filter((s) => ["lower_body", "upper_body_core", "full_body_core"].includes(s.activity_type as string))
    .map((s) => ({
      id: s.id as string,
      weekNumber: s.week_number as number,
      scheduledDate: s.scheduled_date as IsoDate,
      activityType: s.activity_type as ReportSession["activityType"],
    }));
  const ids = sessions.map((s) => s.id);

  const [exRes, fbRes] = ids.length
    ? await Promise.all([
        supabase
          .from("workout_exercises")
          .select("session_id,exercise_id,exercise_name_snapshot,status,prescribed_sets,prescribed_target,measure_type,side_mode")
          .eq("user_id", user.id)
          .in("session_id", ids),
        supabase.from("workout_feedback").select("difficulty").eq("user_id", user.id).in("session_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (exRes.error) throw new Error(`Could not load exercises: ${exRes.error.message}`);
  if (fbRes.error) throw new Error(`Could not load feedback: ${fbRes.error.message}`);
  const exercises: ReportExercise[] = (exRes.data as Row[]).map((e) => ({
    sessionId: e.session_id as string,
    exerciseId: e.exercise_id as string,
    name: e.exercise_name_snapshot as string,
    status: e.status as ReportExercise["status"],
    prescribedSets: e.prescribed_sets as number,
    prescribedTarget: e.prescribed_target as number,
    measureType: e.measure_type as ReportExercise["measureType"],
    sideMode: e.side_mode as ReportExercise["sideMode"],
  }));

  const { today, timing, completion, records } = overview;
  const weeksReached = timing.state === "finished" ? 12 : timing.state === "in_progress" ? timing.week : 0;

  // Counted program days completed per week (recovery excluded while not configured).
  const completedByWeek = new Map<number, number>();
  for (let offset = 0; offset < 84; offset++) {
    const date = addDays(program.startDate, offset);
    const activity = activityForDate(date);
    if (countsTowardCompletion(activity) && isDayCompleted(records, date, activity)) {
      const week = Math.floor(offset / 7) + 1;
      completedByWeek.set(week, (completedByWeek.get(week) ?? 0) + 1);
    }
  }
  const plannedPerWeek = WEEKLY_SCHEDULE.filter((d) => countsTowardCompletion(d.activity)).length;
  const programWalksInProgram = walks.filter(
    (w) => (w.scheduledDate ?? w.activityDate) >= program.startDate && (w.scheduledDate ?? w.activityDate) <= program.endDate,
  );

  return {
    kind: reportKind(timing.state),
    generatedOn: today,
    program,
    timing,
    completion,
    calendarDays: timing.state === "in_progress" ? timing.dayNumber : timing.state === "finished" ? 84 : 0,
    body: bodyChanges(measurements),
    training: trainingSummary({
      sessions,
      exercises,
      feedback: (fbRes.data as Row[]).map((f) => f.difficulty as "too_easy" | "just_right" | "too_hard"),
      strengthPlannedToDate: completion.strength.plannedToDate,
      weeksReached,
    }),
    adjustments,
    walking: walkingReport({ walks: programWalksInProgram, programWalks: walkingCtx.walks, programStart: program.startDate, weeksReached }),
    timeline: weeklyTimeline({
      programStart: program.startDate,
      today,
      completedByWeek,
      plannedPerWeek,
      measurements,
      walks: programWalksInProgram,
    }),
    daysLeft: Math.max(0, diffDays(program.endDate, today)),
  };
});

export type ReportData = NonNullable<Awaited<ReturnType<typeof getReportData>>>;
