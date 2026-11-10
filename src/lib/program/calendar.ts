/**
 * Program calendar maths. Pure functions on ISO dates ("YYYY-MM-DD"),
 * computed in whole days so DST/time-of-day can never shift a workout.
 *
 * "Today" is always taken in the program timezone (Asia/Jakarta), not the
 * server's or browser's local time.
 *
 * Imports use explicit .ts extensions so the module runs under plain Node
 * for unit tests.
 */
import {
  PROGRAM_WEEKS,
  TRAINING_PHASES,
  WEEKLY_SCHEDULE,
  type ActivityType,
  type DayOfWeek,
  RECOVERY_CONFIGURED,
  type ScheduleStatus,
  type TrainingPhase,
} from "./schedule.ts";

export const PROGRAM_TIMEZONE = "Asia/Jakarta";
export const PROGRAM_DAYS = PROGRAM_WEEKS * 7; // 84
/** How many Mondays ahead a program may be scheduled to start. */
export const MAX_START_WEEKS_AHEAD = 8;

export type IsoDate = string;

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function assertIsoDate(value: IsoDate): void {
  if (!isIsoDate(value)) throw new Error(`Invalid ISO date: ${String(value)}`);
}

export function toEpochDay(date: IsoDate): number {
  assertIsoDate(date);
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function fromEpochDay(day: number): IsoDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** a − b in days. */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return toEpochDay(a) - toEpochDay(b);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. (1970-01-01 was a Thursday.) */
export function isoDayOfWeek(date: IsoDate): DayOfWeek {
  return ((((toEpochDay(date) + 3) % 7) + 7) % 7 + 1) as DayOfWeek;
}

export function isMonday(date: IsoDate): boolean {
  return isIsoDate(date) && isoDayOfWeek(date) === 1;
}

export function mondayOf(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoDayOfWeek(date));
}

/** Calendar date in `timeZone` at instant `now`. */
export function todayIn(timeZone: string = PROGRAM_TIMEZONE, now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function programEndDate(startDate: IsoDate): IsoDate {
  return addDays(startDate, PROGRAM_DAYS - 1);
}

/** Program week containing `date` (unclamped: < 1 before start, > 12 after end). */
export function programWeekFor(startDate: IsoDate, date: IsoDate): number {
  return Math.floor(diffDays(date, startDate) / 7) + 1;
}

export function dateForProgramDay(startDate: IsoDate, week: number, day: DayOfWeek): IsoDate {
  return addDays(startDate, (week - 1) * 7 + (day - 1));
}

export function weekDates(startDate: IsoDate, week: number): IsoDate[] {
  return WEEKLY_SCHEDULE.map((d) => dateForProgramDay(startDate, week, d.day));
}

export function phaseForWeek(week: number): TrainingPhase {
  const clamped = Math.min(Math.max(week, 1), PROGRAM_WEEKS);
  const phase = TRAINING_PHASES.find((p) => clamped >= p.firstWeek && clamped <= p.lastWeek);
  if (!phase) throw new Error(`No phase for week ${week}`);
  return phase;
}

export type ProgramTiming =
  | { state: "not_started"; startDate: IsoDate; endDate: IsoDate; daysUntilStart: number }
  | {
      state: "in_progress";
      startDate: IsoDate;
      endDate: IsoDate;
      week: number;
      dayOfWeek: DayOfWeek;
      phase: TrainingPhase;
      /** Days fully or partly elapsed including today, 1…84. */
      dayNumber: number;
      /** Share of the 84 program days reached (calendar time, not workouts). */
      timeProgressPct: number;
    }
  | { state: "finished"; startDate: IsoDate; endDate: IsoDate };

export function programTiming(startDate: IsoDate, today: IsoDate): ProgramTiming {
  const endDate = programEndDate(startDate);
  const offset = diffDays(today, startDate);
  if (offset < 0) return { state: "not_started", startDate, endDate, daysUntilStart: -offset };
  if (offset >= PROGRAM_DAYS) return { state: "finished", startDate, endDate };
  const week = Math.floor(offset / 7) + 1;
  return {
    state: "in_progress",
    startDate,
    endDate,
    week,
    dayOfWeek: isoDayOfWeek(today),
    phase: phaseForWeek(week),
    dayNumber: offset + 1,
    timeProgressPct: Math.round(((offset + 1) / PROGRAM_DAYS) * 100),
  };
}

/**
 * Status of one scheduled day. The schedule never shifts: a past day with no
 * record stays on its own date. It is "late" while still in the current
 * program week (weeks run Monday–Sunday, like the program) and "missed" once
 * that week is over. Completion always wins.
 */
export function dayStatus(args: {
  date: IsoDate;
  today: IsoDate;
  activity: ActivityType;
  completed: boolean;
}): ScheduleStatus {
  if (args.completed) return "completed";
  if (args.activity === "rest") return "rest";
  if (args.activity === "recovery" && !RECOVERY_CONFIGURED) return "not_configured";
  const delta = diffDays(args.date, args.today);
  if (delta === 0) return "today";
  if (delta > 0) return "upcoming";
  return mondayOf(args.date) === mondayOf(args.today) ? "late" : "missed";
}

/** Mondays a new program may start on: this week's Monday + the next 8. */
export function startDateOptions(today: IsoDate, weeksAhead: number = MAX_START_WEEKS_AHEAD): IsoDate[] {
  const first = mondayOf(today);
  return Array.from({ length: weeksAhead + 1 }, (_, i) => addDays(first, i * 7));
}

export function validateStartDate(startDate: unknown, today: IsoDate): string | null {
  if (!isIsoDate(startDate)) return "Choose a valid date.";
  if (!isMonday(startDate)) return "The program must start on a Monday.";
  const earliest = mondayOf(today);
  if (diffDays(startDate, earliest) < 0) return "The start date can't be before this week's Monday.";
  if (diffDays(startDate, earliest) > MAX_START_WEEKS_AHEAD * 7) {
    return `Choose a Monday within the next ${MAX_START_WEEKS_AHEAD} weeks.`;
  }
  return null;
}
