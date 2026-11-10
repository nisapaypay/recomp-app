/**
 * When may a scheduled workout be started? (pure; mirrored by the database
 * function `start_workout_session`, which is the real enforcement.)
 *
 * - Today's strength workout: yes.
 * - A past strength workout that isn't completed: yes, as a catch-up. It is
 *   recorded for its ORIGINAL scheduled date; the calendar never shifts.
 * - A future workout: no — it can be viewed but not started.
 * - Walking, recovery and rest days are not started here.
 * - Only one active workout session at a time.
 */
import { diffDays, todayIn, PROGRAM_TIMEZONE, type IsoDate } from "./calendar.ts";
import { isStrengthDay, type ActivityType } from "./schedule.ts";

export type StartAvailability =
  | { kind: "available"; catchUp: false }
  | { kind: "available"; catchUp: true; daysLate: number }
  | { kind: "not_yet"; availableOn: IsoDate }
  | { kind: "completed" }
  | { kind: "active_elsewhere" }
  | { kind: "not_a_workout" }
  | { kind: "outside_program" };

export function workoutStartAvailability(args: {
  date: IsoDate;
  today: IsoDate;
  activity: ActivityType;
  completed: boolean;
  /** The user already has an active session for a DIFFERENT scheduled day / activity. */
  activeElsewhere: boolean;
  programStart: IsoDate;
  programEnd: IsoDate;
}): StartAvailability {
  if (!isStrengthDay(args.activity)) return { kind: "not_a_workout" };
  if (diffDays(args.date, args.programStart) < 0 || diffDays(args.date, args.programEnd) > 0) {
    return { kind: "outside_program" };
  }
  if (args.completed) return { kind: "completed" };
  const delta = diffDays(args.date, args.today);
  if (delta > 0) return { kind: "not_yet", availableOn: args.date };
  if (args.activeElsewhere) return { kind: "active_elsewhere" };
  return delta === 0 ? { kind: "available", catchUp: false } : { kind: "available", catchUp: true, daysLate: -delta };
}

/** Calendar date (program timezone) on which a timestamp falls. */
export function performedDate(performedAt: string, timeZone: string = PROGRAM_TIMEZONE): IsoDate {
  return todayIn(timeZone, new Date(performedAt));
}

/** True when the workout was performed on a later day than scheduled. */
export function isCatchUp(scheduledDate: IsoDate, performedAt: string | null): boolean {
  return performedAt !== null && diffDays(performedDate(performedAt), scheduledDate) > 0;
}
