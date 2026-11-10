/**
 * Body measurements (pure; unit-tested; shared by the form and the server).
 *
 * - Check-ins are scheduled in program weeks 1, 4, 8 and 12. A check-in may be
 *   recorded a few days late; it still counts for its week (`weekNumber`),
 *   while `recordedOn` keeps the real date. The program never shifts.
 * - Weight and body fat are required; every other field is optional and is
 *   never filled with a default.
 * - Ranges mirror the body_measurements constraints (migration 1).
 * - Changes compare the FIRST and the LATEST recorded value of each metric —
 *   only real values, no interpolation, no predictions.
 *
 * Imports use .ts extensions so the module runs under plain Node in tests.
 */
import { addDays, diffDays, isIsoDate, type IsoDate } from "../program/calendar.ts";

export const CHECK_IN_WEEKS = [1, 4, 8, 12] as const;

export type MetricKey =
  | "weightKg"
  | "bodyFatPct"
  | "skeletalMuscleKg"
  | "visceralFat"
  | "waistCm"
  | "lowerAbdomenCm"
  | "armCm"
  | "thighCm";

export type MetricDef = {
  key: MetricKey;
  column: string;
  label: string;
  unit: string;
  required: boolean;
  min: number;
  max: number;
  decimals: number;
  /** Plain-language context for a change (never "good/bad" for weight). */
  context: string;
};

export const METRICS: readonly MetricDef[] = [
  { key: "weightKg", column: "weight_kg", label: "Weight", unit: "kg", required: true, min: 20, max: 300, decimals: 2,
    context: "In a recomposition weight can stay similar — or rise — while body fat goes down and muscle goes up." },
  { key: "bodyFatPct", column: "body_fat_pct", label: "Body fat", unit: "%", required: true, min: 2, max: 75, decimals: 1,
    context: "Smart-scale body fat moves with hydration and time of day; look at the trend over several check-ins." },
  { key: "skeletalMuscleKg", column: "skeletal_muscle_kg", label: "Skeletal muscle", unit: "kg", required: false, min: 5, max: 80, decimals: 1,
    context: "Muscle is gained slowly; small changes between check-ins are normal." },
  { key: "visceralFat", column: "visceral_fat", label: "Visceral fat", unit: "level", required: false, min: 0, max: 60, decimals: 1,
    context: "A device-specific rating; compare only values from the same device." },
  { key: "waistCm", column: "waist_cm", label: "Waist", unit: "cm", required: false, min: 30, max: 250, decimals: 1,
    context: "Measure at the same spot and time of day each check-in." },
  { key: "lowerAbdomenCm", column: "lower_abdomen_cm", label: "Lower abdomen", unit: "cm", required: false, min: 30, max: 250, decimals: 1,
    context: "Measure at the same spot and time of day each check-in." },
  { key: "armCm", column: "arm_cm", label: "Arm", unit: "cm", required: false, min: 10, max: 80, decimals: 1,
    context: "Arm size can increase with muscle — a rise isn't necessarily fat." },
  { key: "thighCm", column: "thigh_cm", label: "Thigh", unit: "cm", required: false, min: 20, max: 120, decimals: 1,
    context: "Thigh size can increase with muscle — a rise isn't necessarily fat." },
] as const;

export type MetricValues = Record<MetricKey, number | null>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** "53,9" / "53.9" → 53.9; "" → null (or an error when required). */
export function parseMetric(input: string, def: MetricDef): Parsed<number | null> {
  const raw = input.trim().replace(",", ".");
  if (raw === "") return def.required ? { ok: false, error: `${def.label} is required.` } : { ok: true, value: null };
  if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: `Use a number for ${def.label.toLowerCase()} (e.g. 53.9).` };
  const factor = 10 ** def.decimals;
  const value = Math.round(Number(raw) * factor) / factor;
  if (value < def.min || value > def.max) {
    return { ok: false, error: `${def.label} must be between ${def.min} and ${def.max} ${def.unit}.` };
  }
  return { ok: true, value };
}

/** Program week (1–12) of a date; null outside the program. */
export function programWeekOf(programStart: IsoDate, date: IsoDate): number | null {
  const d = diffDays(date, programStart);
  if (d < 0 || d >= 84) return null;
  return Math.floor(d / 7) + 1;
}

export type MeasurementInput = Record<MetricKey, string> & {
  recordedOn: string;
  /** Program week this counts for ("" = the week of the date). */
  weekNumber: string;
  notes: string;
};

export type MeasurementValue = MetricValues & { recordedOn: IsoDate; weekNumber: number; notes: string | null };

export type MeasurementErrors = Partial<Record<MetricKey | "recordedOn" | "weekNumber" | "notes", string>>;

export function validateMeasurement(
  input: MeasurementInput,
  ctx: { today: IsoDate; programStart: IsoDate | null; takenWeeks: ReadonlySet<number>; editingWeek?: number | null },
): { ok: true; value: MeasurementValue } | { ok: false; errors: MeasurementErrors } {
  const errors: MeasurementErrors = {};
  const values = {} as MetricValues;
  for (const def of METRICS) {
    const r = parseMetric(input[def.key] ?? "", def);
    if (r.ok) values[def.key] = r.value;
    else errors[def.key] = r.error;
  }

  let recordedOn: IsoDate | null = null;
  if (!isIsoDate(input.recordedOn)) errors.recordedOn = "Choose a valid date.";
  else if (diffDays(input.recordedOn, ctx.today) > 0) errors.recordedOn = "The date can't be in the future.";
  else recordedOn = input.recordedOn;

  let week: number | null = null;
  if (input.weekNumber.trim() !== "") {
    const n = Number(input.weekNumber);
    if (!Number.isInteger(n) || n < 1 || n > 12) errors.weekNumber = "Choose a program week between 1 and 12.";
    else week = n;
  } else if (recordedOn) {
    week = ctx.programStart ? programWeekOf(ctx.programStart, recordedOn) : null;
    if (week === null) errors.weekNumber = "This date is outside your program — choose the check-in week.";
  }
  if (week !== null && ctx.programStart && recordedOn) {
    const weekStart = addDays(ctx.programStart, (week - 1) * 7);
    if (diffDays(recordedOn, weekStart) < 0) errors.weekNumber = `Week ${week} hadn't started on that date.`;
  }
  if (week !== null && ctx.takenWeeks.has(week) && week !== (ctx.editingWeek ?? null)) {
    errors.weekNumber = `Week ${week} already has a measurement — edit that one instead.`;
  }

  const notes = input.notes.trim();
  if (notes.length > 1000) errors.notes = "Notes are too long (max 1000 characters).";

  if (Object.keys(errors).length > 0 || recordedOn === null || week === null) return { ok: false, errors };
  return { ok: true, value: { ...values, recordedOn, weekNumber: week, notes: notes === "" ? null : notes } };
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export type CheckInStatus = "done" | "due" | "late" | "upcoming";

export type CheckIn = {
  week: number;
  /** Monday … Sunday of that program week. */
  windowStart: IsoDate;
  windowEnd: IsoDate;
  status: CheckInStatus;
  recordedOn: IsoDate | null;
};

/** Official check-ins with status. Late = its week is over and nothing is saved (still recordable). */
export function checkInSchedule(programStart: IsoDate, today: IsoDate, recorded: ReadonlyMap<number, IsoDate>): CheckIn[] {
  return CHECK_IN_WEEKS.map((week) => {
    const windowStart = addDays(programStart, (week - 1) * 7);
    const windowEnd = addDays(windowStart, 6);
    const recordedOn = recorded.get(week) ?? null;
    const status: CheckInStatus = recordedOn
      ? "done"
      : diffDays(today, windowStart) < 0
        ? "upcoming"
        : diffDays(today, windowEnd) <= 0
          ? "due"
          : "late";
    return { week, windowStart, windowEnd, status, recordedOn };
  });
}

/** The check-in to do next: a due or late one first, else the next upcoming; null when all done. */
export function nextCheckIn(schedule: CheckIn[]): CheckIn | null {
  return (
    schedule.find((c) => c.status === "due") ??
    schedule.find((c) => c.status === "late") ??
    schedule.find((c) => c.status === "upcoming") ??
    null
  );
}

/** Week the form should suggest for a date: the latest open check-in already started, else that date's week. */
export function suggestedWeek(schedule: CheckIn[], programStart: IsoDate, date: IsoDate): number | null {
  const open = schedule.filter((c) => c.status !== "done" && diffDays(date, c.windowStart) >= 0);
  if (open.length > 0) return open[open.length - 1].week;
  return programWeekOf(programStart, date);
}

// ---------------------------------------------------------------------------
// Changes & series (real values only)
// ---------------------------------------------------------------------------

export type MeasurementRecord = MetricValues & { id: string; recordedOn: IsoDate; weekNumber: number };

export type MetricPoint = { date: IsoDate; week: number; value: number };

/** Points for one metric, oldest first, only where a value was recorded. */
export function seriesFor(records: MeasurementRecord[], key: MetricKey): MetricPoint[] {
  return records
    .filter((r) => r[key] !== null)
    .map((r) => ({ date: r.recordedOn, week: r.weekNumber, value: r[key] as number }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.week - b.week);
}

export type MetricChange = {
  first: MetricPoint;
  latest: MetricPoint;
  /** latest − first; null when there is only one value. */
  delta: number | null;
};

export function changeFor(records: MeasurementRecord[], def: MetricDef): MetricChange | null {
  const points = seriesFor(records, def.key);
  if (points.length === 0) return null;
  const first = points[0];
  const latest = points[points.length - 1];
  const factor = 10 ** def.decimals;
  const delta = points.length > 1 ? Math.round((latest.value - first.value) * factor) / factor : null;
  return { first, latest, delta };
}

export function formatValue(value: number, def: Pick<MetricDef, "unit" | "decimals">): string {
  const shown = Number(value.toFixed(def.decimals));
  return def.unit === "level" ? `${shown}` : def.unit === "%" ? `${shown}%` : `${shown} ${def.unit}`;
}

/** "+0.8 kg", "−1.2 kg", "no change" — neutral wording, the sign only says up or down. */
export function formatDelta(delta: number, def: Pick<MetricDef, "unit" | "decimals">): string {
  if (delta === 0) return "no change";
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  const unit = def.unit === "%" ? " pts" : def.unit === "level" ? "" : ` ${def.unit}`;
  return `${sign}${Number(abs.toFixed(def.decimals))}${unit}`;
}
