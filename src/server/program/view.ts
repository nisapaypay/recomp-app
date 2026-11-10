import "server-only";

import {
  dateForProgramDay,
  dayStatus,
  diffDays,
  programTiming,
  type IsoDate,
  type ProgramTiming,
} from "@/lib/program/calendar";
import { estimateWorkoutSeconds, type EstimateInput } from "@/lib/program/estimate";
import { isDayCompleted, programCompletion, sessionKey, type ProgramCompletion } from "@/lib/program/completion";
import { WEEKLY_SCHEDULE, countsTowardCompletion, isStrengthDay, type ScheduleStatus } from "@/lib/program/schedule";
import type { Prescription, ProgramDay, UserProgram } from "@/lib/program/types";
import { getActivityRecords, getProgramWeek, getToday, type ProgramRecords } from "./queries";

export type DayView = ProgramDay & {
  date: IsoDate;
  label: string;
  shortLabel: string;
  activityLabel: string;
  status: ScheduleStatus;
  isToday: boolean;
  prescriptions: Prescription[];
  estimatedSeconds: number;
  /** When a completed workout for this day was actually performed (may be a later day). */
  performedAt: string | null;
};

export type ProgramOverview = {
  program: UserProgram;
  today: IsoDate;
  timing: ProgramTiming;
  /** Week shown by default: current week, week 1 before start, 12 after end. */
  currentWeek: number;
  records: ProgramRecords;
  /** Planned vs completed, in total and per category (strength / walking / recovery). */
  completion: ProgramCompletion;
};

export function toEstimateInput(p: Prescription): EstimateInput {
  return {
    sets: p.sets,
    target: p.targetMin,
    measureType: p.exercise.measureType,
    sideMode: p.exercise.sideMode,
    tempo: p.tempo,
    restSeconds: p.restSeconds,
  };
}

export async function getProgramOverview(program: UserProgram): Promise<ProgramOverview> {
  const today = await getToday();
  const timing = programTiming(program.startDate, today);
  const currentWeek =
    timing.state === "in_progress" ? timing.week : timing.state === "not_started" ? 1 : 12;

  const records = await getActivityRecords(program.startDate, program.endDate);

  return {
    program,
    today,
    timing,
    currentWeek,
    records,
    completion: programCompletion(program.startDate, today, records),
  };
}

export async function getWeekView(overview: ProgramOverview, week: number): Promise<DayView[]> {
  const { days, prescriptions } = await getProgramWeek(week);
  return WEEKLY_SCHEDULE.map((schedule) => {
    const day = days.find((d) => d.dayOfWeek === schedule.day);
    if (!day) throw new Error(`Program data missing for week ${week}, day ${schedule.day}`);
    const date = dateForProgramDay(overview.program.startDate, week, schedule.day);
    const dayPrescriptions = prescriptions.filter((p) => p.dayOfWeek === schedule.day);
    return {
      ...day,
      date,
      label: schedule.label,
      shortLabel: schedule.shortLabel,
      activityLabel: schedule.activityLabel,
      status: dayStatus({
        date,
        today: overview.today,
        activity: day.activity,
        completed: isDayCompleted(overview.records, date, day.activity),
      }),
      isToday: date === overview.today,
      prescriptions: dayPrescriptions,
      estimatedSeconds: estimateWorkoutSeconds(dayPrescriptions.map(toEstimateInput)),
      performedAt: overview.records.performedAt.get(sessionKey(date, day.activity)) ?? null,
    };
  });
}

/** First strength workout scheduled after today (within the program), or null. */
export async function getNextWorkout(overview: ProgramOverview): Promise<{ day: DayView; week: number } | null> {
  for (let week = overview.currentWeek; week <= 12; week++) {
    const days = await getWeekView(overview, week);
    const next = days.find((d) => isStrengthDay(d.activity) && diffDays(d.date, overview.today) > 0);
    if (next) return { day: next, week };
  }
  return null;
}

/** Week completion: completed non-rest days / non-rest days in the week. */
export function weekCompletion(days: DayView[]): { completed: number; planned: number } {
  const planned = days.filter((d) => countsTowardCompletion(d.activity));
  return { completed: planned.filter((d) => d.status === "completed").length, planned: planned.length };
}
