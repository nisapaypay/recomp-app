/**
 * Program completion from real records (pure; unit-tested).
 *
 * Plan per week: 3 strength (Mon/Wed/Fri) + 2 walking (Tue/Sat) + 1 recovery (Thu)
 * = 6 planned activities, Sunday is rest → 72 over 12 weeks.
 *
 * A day counts as completed only when a record of the MATCHING activity
 * exists on that date: a completed recovery session completes Thursday's
 * recovery and nothing else — it is never counted as a strength workout.
 */
import { PROGRAM_DAYS, addDays, diffDays, isoDayOfWeek, type IsoDate } from "./calendar.ts";
import { RECOVERY_CONFIGURED, WEEKLY_SCHEDULE, isStrengthDay, type ActivityType } from "./schedule.ts";

/** The fixed activity for a calendar date — depends only on the weekday. */
export function activityForDate(date: IsoDate): ActivityType {
  return WEEKLY_SCHEDULE[isoDayOfWeek(date) - 1].activity;
}

export type ActivityRecords = {
  /** "YYYY-MM-DD|activity" of completed workout sessions (strength or recovery). */
  completedSessions: Set<string>;
  /** Scheduled walking days (Tue/Sat) that have a logged walk counting for them. */
  walkDates: Set<IsoDate>;
};

export function sessionKey(date: IsoDate, activity: ActivityType): string {
  return `${date}|${activity}`;
}

export function isDayCompleted(records: ActivityRecords, date: IsoDate, activity: ActivityType): boolean {
  if (activity === "rest") return false;
  if (activity === "walking") return records.walkDates.has(date);
  return records.completedSessions.has(sessionKey(date, activity));
}

export type CompletionCount = {
  completed: number;
  planned: number;
  /** Planned days up to and including today. */
  plannedToDate: number;
};

export type ProgramCompletion = {
  /** Strength + walking (+ recovery once it is configured). */
  total: CompletionCount;
  /** False while the recovery routine isn't configured: recovery is then excluded from `total`. */
  recoveryConfigured: boolean;
  strength: CompletionCount;
  walking: CompletionCount;
  recovery: CompletionCount;
};

type Category = "strength" | "walking" | "recovery";

function categoryOf(activity: ActivityType): Category | null {
  if (activity === "rest") return null;
  if (isStrengthDay(activity)) return "strength";
  return activity === "walking" ? "walking" : "recovery";
}

export function programCompletion(
  startDate: IsoDate,
  today: IsoDate,
  records: ActivityRecords,
): ProgramCompletion {
  const zero = (): CompletionCount => ({ completed: 0, planned: 0, plannedToDate: 0 });
  const result: ProgramCompletion = {
    total: zero(),
    recoveryConfigured: RECOVERY_CONFIGURED,
    strength: zero(),
    walking: zero(),
    recovery: zero(),
  };

  for (let offset = 0; offset < PROGRAM_DAYS; offset++) {
    const date = addDays(startDate, offset);
    const activity = activityForDate(date);
    const category = categoryOf(activity);
    if (!category) continue;

    const reached = diffDays(date, today) <= 0;
    const done = isDayCompleted(records, date, activity);
    const buckets = category === "recovery" && !RECOVERY_CONFIGURED ? [result.recovery] : [result.total, result[category]];
    for (const bucket of buckets) {
      bucket.planned += 1;
      if (reached) bucket.plannedToDate += 1;
      if (done) bucket.completed += 1;
    }
  }
  return result;
}
