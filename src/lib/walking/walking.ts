/**
 * Walking tracker rules (pure; unit-tested; shared by the form and the server).
 *
 * - Manual logs (Apple Watch or any device): date, duration, distance; steps
 *   and notes optional. No GPS, no Apple Health.
 * - A log either counts for ONE scheduled program walk (Tuesday / Saturday,
 *   `scheduledDate`) or is an additional walk (`scheduledDate = null`).
 *   The schedule never shifts: a Tuesday walk done on Thursday still counts
 *   for Tuesday. A scheduled walk can be logged from the Monday of its program
 *   week onwards (catch-up allowed), never for a future date.
 * - Mirrored in the database (migration 11: unique scheduled walk, trigger).
 *
 * Imports use .ts extensions so the module runs under plain Node in tests.
 */
import { addDays, diffDays, isIsoDate, mondayOf, type IsoDate } from "../program/calendar.ts";

export const MAX_MINUTES = 600;
export const MAX_KM = 100;
export const MAX_STEPS = 200_000;
export const MAX_NOTES = 1000;

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const INT = /^\d+$/;

/** Hours + minutes fields → whole minutes (1 … 600). Empty hours = 0. */
export function parseDuration(hours: string, minutes: string): Parsed<number> {
  const h = hours.trim() === "" ? "0" : hours.trim();
  const m = minutes.trim() === "" ? "0" : minutes.trim();
  if (!INT.test(h) || !INT.test(m)) return { ok: false, error: "Use whole numbers for hours and minutes." };
  const hv = Number(h);
  const mv = Number(m);
  if (mv > 59) return { ok: false, error: "Minutes must be 0–59 (use the hours field for more)." };
  const total = hv * 60 + mv;
  if (total <= 0) return { ok: false, error: "Enter how long you walked." };
  if (total > MAX_MINUTES) return { ok: false, error: "That's more than 10 hours — please check the duration." };
  return { ok: true, value: total };
}

/** "2.5" or "2,5" → 2.5 km (rounded to 0.01; 0 < km ≤ 100). */
export function parseDistance(input: string): Parsed<number> {
  const raw = input.trim().replace(",", ".");
  if (raw === "") return { ok: false, error: "Enter the distance in kilometres." };
  if (!/^\d+(\.\d+)?$/.test(raw) && !/^\.\d+$/.test(raw)) {
    return { ok: false, error: "Use a number like 2.5 for the distance." };
  }
  const km = Math.round(Number(raw) * 100) / 100;
  if (!(km > 0)) return { ok: false, error: "Distance must be more than 0 km." };
  if (km > MAX_KM) return { ok: false, error: "That's more than 100 km — please check the distance." };
  return { ok: true, value: km };
}

/** Optional steps: empty → null; otherwise a whole number 1 … 200 000. */
export function parseSteps(input: string): Parsed<number | null> {
  const raw = input.trim().replace(/[.,\s]/g, ""); // allow "4.500" / "4,500" thousands separators
  if (raw === "") return { ok: true, value: null };
  if (!INT.test(raw)) return { ok: false, error: "Steps must be a whole number." };
  const steps = Number(raw);
  if (steps <= 0) return { ok: false, error: "Steps must be more than 0 (or leave it empty)." };
  if (steps > MAX_STEPS) return { ok: false, error: "That's more than 200,000 steps — please check." };
  return { ok: true, value: steps };
}

export function validateActivityDate(date: string, today: IsoDate): Parsed<IsoDate> {
  if (!isIsoDate(date)) return { ok: false, error: "Choose a valid date." };
  if (diffDays(date, today) > 0) return { ok: false, error: "The date can't be in the future." };
  return { ok: true, value: date };
}

// ---------------------------------------------------------------------------
// Calculations (never shown for invalid input)
// ---------------------------------------------------------------------------

/** Pace in seconds per km = duration / distance; null when inputs are invalid. */
export function paceSecondsPerKm(minutes: number | null, km: number | null): number | null {
  if (minutes === null || km === null || !(minutes > 0) || !(km > 0)) return null;
  return Math.round((minutes * 60) / km);
}

/** Average speed in km/h = distance / hours; null when inputs are invalid. */
export function speedKmh(minutes: number | null, km: number | null): number | null {
  if (minutes === null || km === null || !(minutes > 0) || !(km > 0)) return null;
  return km / (minutes / 60);
}

/** 720 → "12:00 min/km". */
export function formatPace(secondsPerKm: number | null): string | null {
  if (secondsPerKm === null) return null;
  const m = Math.floor(secondsPerKm / 60);
  const s = secondsPerKm % 60;
  return `${m}:${String(s).padStart(2, "0")} min/km`;
}

/** 5 → "5.0 km/h". */
export function formatSpeed(kmh: number | null): string | null {
  return kmh === null ? null : `${kmh.toFixed(1)} km/h`;
}

/** 30 → "30 min", 65 → "1 h 05 min", 120 → "2 h". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}

export function formatKm(km: number): string {
  return `${Number(km.toFixed(2))} km`;
}

// ---------------------------------------------------------------------------
// Program walks
// ---------------------------------------------------------------------------

export type WalkingTarget = { week: number; dayOfWeek: number; minMinutes: number; maxMinutes: number };

export type ScheduledWalk = {
  date: IsoDate;
  week: number;
  dayOfWeek: 2 | 6;
  label: "Tuesday Walking" | "Saturday Walking";
  targetMin: number;
  targetMax: number;
};

/** Every program walk (24) with its target, from the program_days rows. */
export function scheduledWalks(programStart: IsoDate, targets: WalkingTarget[]): ScheduledWalk[] {
  return targets
    .filter((t) => t.dayOfWeek === 2 || t.dayOfWeek === 6)
    .map((t) => ({
      date: addDays(programStart, (t.week - 1) * 7 + (t.dayOfWeek - 1)),
      week: t.week,
      dayOfWeek: t.dayOfWeek as 2 | 6,
      label: t.dayOfWeek === 2 ? ("Tuesday Walking" as const) : ("Saturday Walking" as const),
      targetMin: t.minMinutes,
      targetMax: t.maxMinutes,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Can a walk done on `activityDate` count for `walk`? (Its week has started; catch-up allowed.) */
export function canCountFor(walk: Pick<ScheduledWalk, "date">, activityDate: IsoDate): boolean {
  return diffDays(activityDate, mondayOf(walk.date)) >= 0;
}

/**
 * Scheduled walks a log done on `activityDate` may count for: week started,
 * not logged yet (the walk currently being edited stays available).
 */
export function openScheduledWalks(
  walks: ScheduledWalk[],
  loggedDates: ReadonlySet<IsoDate>,
  activityDate: IsoDate,
  editingScheduledDate: IsoDate | null = null,
): ScheduledWalk[] {
  return walks.filter(
    (w) => canCountFor(w, activityDate) && (!loggedDates.has(w.date) || w.date === editingScheduledDate),
  );
}

/** Best default for the form: today's/most recent open walk of the current week, else additional. */
export function defaultScheduledDate(open: ScheduledWalk[], activityDate: IsoDate): IsoDate | null {
  const thisWeek = open.filter((w) => mondayOf(w.date) === mondayOf(activityDate) && diffDays(activityDate, w.date) >= 0);
  return thisWeek.length > 0 ? thisWeek[thisWeek.length - 1].date : null;
}

export type TargetStatus = "met" | "below";

/** A walk meets its target when it lasts at least the minimum target. */
export function targetStatus(minutes: number, targetMin: number): TargetStatus {
  return minutes >= targetMin ? "met" : "below";
}

export function formatTarget(min: number, max: number): string {
  return min === max ? `${min} min` : `${min}–${max} min`;
}

// ---------------------------------------------------------------------------
// Full validation (form + server)
// ---------------------------------------------------------------------------

export type WalkInput = {
  activityDate: string;
  hours: string;
  minutes: string;
  distance: string;
  steps: string;
  notes: string;
  /** ISO date of the scheduled walk, or "" for an additional walk. */
  scheduledDate: string;
};

export type WalkValue = {
  activityDate: IsoDate;
  durationMinutes: number;
  distanceKm: number;
  steps: number | null;
  notes: string | null;
  scheduledDate: IsoDate | null;
};

export type WalkErrors = Partial<Record<"activityDate" | "duration" | "distance" | "steps" | "notes" | "scheduledDate", string>>;

export function validateWalk(
  input: WalkInput,
  ctx: { today: IsoDate; walks: ScheduledWalk[]; loggedDates: ReadonlySet<IsoDate>; editingScheduledDate?: IsoDate | null },
): { ok: true; value: WalkValue } | { ok: false; errors: WalkErrors } {
  const errors: WalkErrors = {};
  const date = validateActivityDate(input.activityDate, ctx.today);
  const duration = parseDuration(input.hours, input.minutes);
  const distance = parseDistance(input.distance);
  const steps = parseSteps(input.steps);
  const notes = input.notes.trim();
  if (!date.ok) errors.activityDate = date.error;
  if (!duration.ok) errors.duration = duration.error;
  if (!distance.ok) errors.distance = distance.error;
  if (!steps.ok) errors.steps = steps.error;
  if (notes.length > MAX_NOTES) errors.notes = "Notes are too long (max 1000 characters).";

  let scheduledDate: IsoDate | null = null;
  if (input.scheduledDate !== "") {
    const walk = ctx.walks.find((w) => w.date === input.scheduledDate);
    if (!walk) {
      errors.scheduledDate = "That isn't one of your program walks.";
    } else if (ctx.loggedDates.has(walk.date) && walk.date !== (ctx.editingScheduledDate ?? null)) {
      errors.scheduledDate = `${walk.label} of ${walk.date} is already logged. Log this one as an additional walk instead.`;
    } else if (date.ok && !canCountFor(walk, date.value)) {
      errors.scheduledDate = "A walk can't count for a program week that hadn't started yet.";
    } else {
      scheduledDate = walk.date;
    }
  }

  if (Object.keys(errors).length > 0 || !date.ok || !duration.ok || !distance.ok || !steps.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      activityDate: date.value,
      durationMinutes: duration.value,
      distanceKm: distance.value,
      steps: steps.value,
      notes: notes === "" ? null : notes,
      scheduledDate,
    },
  };
}

// ---------------------------------------------------------------------------
// Summaries (real records only)
// ---------------------------------------------------------------------------

export type WalkRecord = {
  activityDate: IsoDate;
  scheduledDate: IsoDate | null;
  durationMinutes: number;
  distanceKm: number | null;
  steps: number | null;
};

export function walkingTotals(walks: WalkRecord[]) {
  const withSteps = walks.filter((w) => w.steps !== null);
  return {
    count: walks.length,
    scheduled: walks.filter((w) => w.scheduledDate !== null).length,
    additional: walks.filter((w) => w.scheduledDate === null).length,
    minutes: walks.reduce((n, w) => n + w.durationMinutes, 0),
    km: Math.round(walks.reduce((n, w) => n + (w.distanceKm ?? 0), 0) * 100) / 100,
    /** null when no walk has steps — never invented. */
    steps: withSteps.length > 0 ? withSteps.reduce((n, w) => n + (w.steps ?? 0), 0) : null,
  };
}

/**
 * Completion of the program walks in one week: a scheduled walk is completed
 * when a log counts for it; additional walks never add to it.
 */
export function weeklyWalkingCompletion(weekWalks: ScheduledWalk[], logs: WalkRecord[]) {
  const byDate = new Map(logs.filter((l) => l.scheduledDate !== null).map((l) => [l.scheduledDate as IsoDate, l]));
  let completed = 0;
  let targetMet = 0;
  for (const w of weekWalks) {
    const log = byDate.get(w.date);
    if (!log) continue;
    completed += 1;
    if (targetStatus(log.durationMinutes, w.targetMin) === "met") targetMet += 1;
  }
  return { planned: weekWalks.length, completed, targetMet };
}
